import type { createAdminClient } from '@/lib/supabase/admin'
import { addDaysKst, kstDateOf, todayKstIsoDate } from '@/lib/datetime-kst'
import { chargeDateFor, chargeTimingFor } from '@/lib/shipping-schedule'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { STORE_ORDER_PREFIX } from '@/lib/store/order-number'
import { storeShipDate } from '@/lib/store/shipping'
import { classifyCancellation } from '@/lib/admin/churn'
import { chargeProblemReason } from '@/lib/admin/charge-rows'
import { cycleChargeResults, type ChargeAttempt } from '@/lib/admin/weekly-todo-core'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { loadInternalUserIds, isInternalUser } from '@/lib/admin/internal-accounts'
import type { TrialState } from '@/lib/payments/trial'

/**
 * 어드민 홈 맨 위 '새로 들어온 것' — 최근 7일 (2026-10-24 규칙314).
 *
 * 사장님 "오늘 구독 주문 들어왔는데 … 어드민에서 보기도 너무너무 불편하고". 새 정기배송은 토요일 첫 결제 전까지 주문 표에
 * 줄이 없어서 홈 '최근 들어온 주문'(맨 아래)에도, 화면 위 종에도 안 떴다. 홈 어디에도 '새 정기배송 — 치카 4kg' 같은 줄이 없었다.
 *
 * # 판정 — 전부 이미 있는 정본
 *  · 새 정기배송 = **첫 카드 등록**: 카드 등록 기록(subscription_events kind 'card')의 before.next_delivery_date 가 비어 있고
 *    after 에 생긴 것(배송 일정이 없던 구독에 카드가 붙은 순간 — 사장님 폰 알림 newSubscriptionNotice 와 같은 판정).
 *    결제 실패 뒤 카드를 다시 등록한 것(before 에 날짜가 있음)은 '카드 다시 등록'으로 따로 센다.
 *  · 금액 = 이번에 **실제로** 결제될 금액(resolveAutoDiscount — 청구·고객 화면과 같은 함수). 정가만 보이면 서포터즈 100원
 *    박스가 51,500원처럼 읽힌다(사장님 "가격이 정가로 나와 있어서 헷갈려").
 *  · 결제일 = chargeDateFor(발송일, chargeTimingFor(서포터즈)) — 서포터즈 정보를 못 읽으면 결제일을 단정하지 않는다(null).
 *  · 가게 주문 = 주문번호 FTS- + 결제됨(PAID_STATUSES) · 출고일 storeShipDate(결제일).
 *  · 결제 실패 = 구독마다 **마지막 시도**가 실패(cycleChargeResults — 토 실패 → 일 재시도 성공이면 빠진다) · 사유 chargeProblemReason.
 *  · 해지 = 진짜 해지만(classifyCancellation 'real' — 카드 등록 전 포기·같은 강아지 재구독은 뺀다).
 *  · 시험 계정(사장님·푸린네)은 뺀다(규칙313).
 * 칸마다 조회 실패를 null + failures 로 돌려준다 — 0건과 '못 봄'을 같게 그리지 않는다(규칙1).
 */

type Db = ReturnType<typeof createAdminClient>

export type NewSubArrival = {
  subscriptionId: string
  userId: string
  dogName: string
  weightKg: number | null
  recipes: string
  freshLabel: string
  /** 이번에 실제로 결제될 금액. null = 계산 못 함(저장 금액 storedAmount 를 대신 보인다). */
  chargeAmount: number | null
  chargeLabel: string | null
  storedAmount: number
  chargeIso: string | null
  shipIso: string | null
  /** 카드 등록 시각 — '새' 배지(48시간)·정렬. */
  at: string
  /** 결제 실패 뒤 카드를 다시 등록해 이어진 것(새 고객이 아님). */
  reRegistered: boolean
}

export type StoreArrival = { orderId: string; orderNumber: string; who: string; amount: number; paidAt: string; shipIso: string; tracked: boolean }
export type FailedArrival = { subscriptionId: string; userId: string; dogName: string; reason: string; at: string | null }
export type CancelArrival = { subscriptionId: string; userId: string; dogName: string; at: string }

export type NewArrivals = {
  since: string
  newSubs: NewSubArrival[] | null
  store: StoreArrival[] | null
  failed: FailedArrival[] | null
  cancelled: CancelArrival[] | null
  failures: string[]
}

const DAYS = 7
const shortRecipe = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*화식$/, '').replace(/\s*레시피$/, '').trim()

export async function loadNewArrivals(db: Db, now: Date = new Date()): Promise<NewArrivals> {
  const today = todayKstIsoDate()
  const sinceIso = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const failures: string[] = []
  const internal = await loadInternalUserIds(db)
  if (!internal.ok) failures.push(`시험 계정 목록: ${internal.error}`)
  const notTest = (userId: string | null | undefined) => !isInternalUser(userId, internal.ids)

  const [eventsRes, storeRes, chargesRes, cancelRes, liveRes] = await Promise.all([
    db
      .from('subscription_events')
      .select('subscription_id, user_id, before, after, created_at')
      .eq('kind', 'card')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('orders')
      .select('id, user_id, order_number, recipient_name, total_amount, paid_at, tracking_number')
      .like('order_number', `${STORE_ORDER_PREFIX}%`)
      .in('payment_status', [...PAID_STATUSES])
      .gte('paid_at', sinceIso)
      .order('paid_at', { ascending: false })
      .limit(100),
    db
      .from('subscription_charges')
      .select('subscription_id, status, attempted_at, scheduled_for, error_code, error_message')
      .gte('attempted_at', sinceIso)
      .limit(2000),
    db
      .from('subscriptions')
      .select('id, user_id, dog_id, cancelled_at, last_charged_at, total_deliveries')
      .eq('status', 'cancelled')
      .gte('cancelled_at', sinceIso)
      .limit(500),
    db.from('subscriptions').select('dog_id').in('status', ['active', 'paused']).limit(5000),
  ])

  // ── 새 정기배송(첫 카드 등록)·카드 다시 등록 ──
  type Ev = { subscription_id: string; user_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; created_at: string }
  let newSubs: NewSubArrival[] | null = null
  if (eventsRes.error) {
    failures.push(`카드 등록 기록: ${eventsRes.error.message}`)
  } else {
    const firstBySub = new Map<string, { at: string; reRegistered: boolean }>()
    for (const e of (eventsRes.data ?? []) as Ev[]) {
      const afterDate = typeof e.after?.next_delivery_date === 'string' ? e.after.next_delivery_date : null
      if (!afterDate || !e.before || !('next_delivery_date' in e.before)) continue // 일정이 안 생긴 카드 교체
      if (!notTest(e.user_id)) continue
      if (firstBySub.has(e.subscription_id)) continue // 최신 순 — 한 구독은 한 줄
      firstBySub.set(e.subscription_id, { at: e.created_at, reRegistered: e.before.next_delivery_date != null })
    }
    const ids = [...firstBySub.keys()]
    newSubs = []
    if (ids.length > 0) {
      const { data: subRows, error: subErr } = await db
        .from('subscriptions')
        .select('id, user_id, dog_id, status, total_amount, fresh_ratio, next_delivery_date, subscription_items(product_name), dogs(name, weight)')
        .in('id', ids)
      if (subErr) {
        failures.push(`새 정기배송: ${subErr.message}`)
        newSubs = null
      } else {
        type SubRow = {
          id: string
          user_id: string
          status: string
          total_amount: number
          fresh_ratio: number | null
          next_delivery_date: string | null
          subscription_items: Array<{ product_name: string }> | null
          dogs: { name: string; weight: number | null } | null
        }
        const rows = (subRows ?? []) as unknown as SubRow[]
        const userIds = [...new Set(rows.map((r) => r.user_id))]
        const { data: trialRows, error: trialErr } = userIds.length
          ? await db.from('subscription_trials').select('user_id, cheap_remaining, half_remaining').in('user_id', userIds)
          : { data: [], error: null }
        if (trialErr) failures.push(`서포터즈(결제일): ${trialErr.message}`)
        const trialBy = new Map(((trialRows ?? []) as Array<TrialState & { user_id: string }>).map((t) => [t.user_id, t]))
        newSubs = await Promise.all(
          rows.map(async (r): Promise<NewSubArrival> => {
            const ev = firstBySub.get(r.id)!
            let chargeAmount: number | null = null
            let chargeLabel: string | null = null
            if (r.status !== 'cancelled') {
              try {
                const d = await resolveAutoDiscount({ userId: r.user_id, subtotal: r.total_amount ?? 0, subscriptionId: r.id })
                chargeAmount = d.chargeAmount
                chargeLabel = d.label
              } catch (e) {
                failures.push(`금액(${r.dogs?.name ?? r.id.slice(0, 8)}): ${e instanceof Error ? e.message : String(e)}`)
              }
            }
            const shipIso = r.next_delivery_date
            return {
              subscriptionId: r.id,
              userId: r.user_id,
              dogName: r.dogs?.name ?? '(강아지 미상)',
              weightKg: r.dogs?.weight ?? null,
              recipes: [...new Set((r.subscription_items ?? []).map((i) => shortRecipe(i.product_name)).filter(Boolean))].join(' + '),
              freshLabel: freshTierLabel(r.fresh_ratio),
              chargeAmount,
              chargeLabel,
              storedAmount: r.total_amount ?? 0,
              shipIso,
              chargeIso: shipIso && !trialErr ? chargeDateFor(shipIso, chargeTimingFor(trialBy.get(r.user_id))) : null,
              at: ev.at,
              reRegistered: ev.reRegistered,
            }
          }),
        )
        newSubs.sort((a, b) => b.at.localeCompare(a.at))
      }
    }
  }

  // ── 가게 주문 ──
  let store: StoreArrival[] | null = null
  if (storeRes.error) {
    failures.push(`가게 주문: ${storeRes.error.message}`)
  } else {
    type O = { id: string; user_id: string | null; order_number: string; recipient_name: string | null; total_amount: number; paid_at: string; tracking_number: string | null }
    store = ((storeRes.data ?? []) as O[])
      .filter((o) => notTest(o.user_id))
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.order_number,
        who: o.recipient_name || '보호자',
        amount: o.total_amount,
        paidAt: o.paid_at,
        shipIso: storeShipDate(kstDateOf(o.paid_at)),
        tracked: !!o.tracking_number,
      }))
  }

  // ── 결제 실패(마지막 시도) ──
  let failed: FailedArrival[] | null = null
  if (chargesRes.error) {
    failures.push(`결제 기록: ${chargesRes.error.message}`)
  } else {
    type C = ChargeAttempt & { error_message: string | null }
    const rows = (chargesRes.data ?? []) as C[]
    const res = cycleChargeResults(rows)
    const failedIds = res.failed.map((f) => f.subscriptionId)
    failed = []
    if (failedIds.length > 0) {
      const { data: fs, error: fErr } = await db.from('subscriptions').select('id, user_id, dogs(name)').in('id', failedIds)
      if (fErr) {
        failures.push(`결제 실패 구독: ${fErr.message}`)
        failed = null
      } else {
        const subBy = new Map(((fs ?? []) as unknown as Array<{ id: string; user_id: string; dogs: { name: string } | null }>).map((s) => [s.id, s]))
        for (const subId of failedIds) {
          const s = subBy.get(subId)
          if (!s || !notTest(s.user_id)) continue
          // 그 구독의 마지막 시도(cycleChargeResults 와 같은 순서 키)
          const last = rows
            .filter((r) => r.subscription_id === subId)
            .sort((a, b) => `${b.scheduled_for}|${b.attempted_at ?? ''}`.localeCompare(`${a.scheduled_for}|${a.attempted_at ?? ''}`))[0]!
          failed.push({ subscriptionId: subId, userId: s.user_id, dogName: s.dogs?.name ?? '(강아지 미상)', reason: chargeProblemReason(last), at: last.attempted_at })
        }
      }
    }
  }

  // ── 진짜 해지 ──
  let cancelled: CancelArrival[] | null = null
  if (cancelRes.error || liveRes.error) {
    failures.push(`해지: ${(cancelRes.error ?? liveRes.error)!.message}`)
  } else {
    const liveDogIds = new Set(((liveRes.data ?? []) as Array<{ dog_id: string | null }>).map((r) => r.dog_id).filter((x): x is string => !!x))
    type K = { id: string; user_id: string; dog_id: string | null; cancelled_at: string; last_charged_at: string | null; total_deliveries: number | null }
    const real = ((cancelRes.data ?? []) as K[]).filter((s) => notTest(s.user_id) && classifyCancellation(s, liveDogIds) === 'real')
    cancelled = []
    if (real.length > 0) {
      const dogIds = [...new Set(real.map((s) => s.dog_id).filter((x): x is string => !!x))]
      const { data: dogRows, error: dErr } = dogIds.length ? await db.from('dogs').select('id, name').in('id', dogIds) : { data: [], error: null }
      if (dErr) failures.push(`해지 강아지 이름: ${dErr.message}`)
      const nameBy = new Map(((dogRows ?? []) as Array<{ id: string; name: string }>).map((d) => [d.id, d.name]))
      cancelled = real.map((s) => ({ subscriptionId: s.id, userId: s.user_id, dogName: (s.dog_id && nameBy.get(s.dog_id)) || '(강아지 미상)', at: s.cancelled_at }))
    }
  }

  return { since: addDaysKst(today, -DAYS), newSubs, store, failed, cancelled, failures }
}
