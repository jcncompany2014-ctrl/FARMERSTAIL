import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  computeBoxPlan,
  subscribableItems,
} from '@/lib/personalization/boxPricing'
import { loadBlockedLinesByDog } from '@/lib/personalization/dogAllergyBlocks'
import { servingFormulaByDog } from '@/lib/personalization/servingFormula'
import type { Formula } from '@/lib/personalization/types'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { addDaysKst, todayKstIsoDate, kstDateOf } from '@/lib/datetime-kst'
import {
  chargeRunPassed,
  shipBlockReason,
  SHIP_BLOCK_LABEL,
  type ShipBlockReason,
} from '@/lib/admin/ship-block'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { chargeTimingFor, chargeDateFor, nextChargeRunDate, type ChargeTiming } from '@/lib/shipping-schedule'
import { loadChargeProjection } from '@/lib/payments/charge-projection-load'
import type { ProjectedRound } from '@/lib/payments/charge-projection'

/**
 * 이번 발송일(화) 포장 요약 — '이번 주 할 일'의 월요일 칸 (2026-10-14 어드민 B2, 규칙249).
 *
 * # 포장 목록과 같은 판정
 * 포장 목록(app/admin/personalization/picking-list/page.tsx)이 쓰는 정본 함수를 **그대로** 부른다:
 *  · 발송 금지 판정 = lib/admin/ship-block shipBlockReason(라벨·조리 합계·CSV 와 같은 함수)
 *  · 박스 계산 = lib/personalization/boxPricing computeBoxPlan · subscribableItems · computeBoxItems(담지 못한 몫·빠진 항목)
 *  · 발송일 기준 처방 = lib/personalization/servingFormula servingFormulaByDog(포장 목록의 손 루프와 같은 규칙)
 *  · 알레르기 = loadBlockedLinesByDog · 결제일 = chargeDateFor(chargeTimingFor) · 청구 시각 = chargeRunPassed
 * 행마다 판정 입력(cannotCharge·skippedNotCharged…)을 만드는 식은 포장 목록과 **글자 그대로 같다** — 규칙249 가 두 파일의
 * 식을 대조해 하나만 바뀌면 빨간불을 켠다(같은 판정을 두 곳에 두면 두 화면이 다른 말을 한다 — 과거 실제 사고).
 * 포장 목록 화면이 이 함수를 부르게 바꾸면 사본이 하나로 준다(포장 목록은 이번 작업에서 다른 갈래 담당이라 손대지 않았다).
 *
 * # 실패
 * 결제 증거·처방·설문 조회가 하나라도 실패하면 숫자를 내지 않고 { ok: false } — 포장 목록이 '목록을 믿을 수 없어요'로 멈추는
 * 것과 같은 이유(틀린 '포장할 박스 N'보다 '못 셈'이 안전하다, 규칙1).
 */

type SubRow = {
  id: string
  dog_id: string | null
  user_id: string
  fresh_ratio: number | null
  next_delivery_date: string | null
  status: string
  has_billing_key: boolean
  requires_billing_key_renewal: boolean | null
  last_failed_charge_at: string | null
  total_amount: number
}

type FormulaRow = {
  id: string
  dog_id: string
  cycle_number: number
  formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
  daily_kcal: number
  approval_status: string | null
  applied_from: string | null
  created_at: string | null
}

type PickProduct = {
  slug: string
  name: string
  price: number
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
}

/** 확인 필요 사유 — 발송 금지(ship-block) + 포장 목록의 나머지 '확인 필요'(처방·비율·빠진 항목·결제 뒤 정지·일정 이동). */
export type PackingProblem =
  | Exclude<ShipBlockReason, null | 'already_shipped'>
  | 'no_formula'
  | 'fresh_unknown'
  | 'missing_items'
  | 'paused_after_charge'
  | 'date_moved_after_charge'
  | 'overdue_paid'

export const PACKING_PROBLEM_LABEL: Record<PackingProblem, string> = {
  cannot_charge: '청구 불가(카드 없음·영구 거절)',
  charge_failed_today: '오늘 청구 실패',
  paused_before_charge: '고객이 결제 전에 정지',
  skipped_not_charged: '고객이 미룸 — 미청구',
  overdue_not_charged: '청구 지연 — 결제 전',
  not_charged_after_run: '청구 시각 지남 — 미청구',
  allergy_check_needed: '알레르기 확인 필요',
  no_formula: '처방 없음',
  fresh_unknown: '화식 비율 미상',
  missing_items: '담을 수 없는 항목(품절·판매중지)',
  paused_after_charge: '결제 후 정지됨',
  date_moved_after_charge: '결제 뒤 일정 이동',
  overdue_paid: '예정일 지남(결제는 됨)',
  price_consent_missing: '가격 인상 동의 없음 — 청구 보류',
}

export type PackingBox = {
  subId: string
  dogName: string
  /** 발송 금지 사유(ship-block) — null 이면 라벨·조리 대상. */
  block: ShipBlockReason
  /** 포장 목록의 '확인 필요' 사유들(발송 금지 + 그 밖). */
  problems: PackingProblem[]
}

export type PackingWeek =
  | {
      ok: true
      shipDate: string
      /** 이 발송일 목록의 박스(이미 보낸 것 포함 — 포장 목록의 '발송 박스'와 같은 수). */
      boxes: number
      /** 라벨·조리 대상 = isShippable(발송 금지 사유 없음). */
      shippable: number
      alreadyShipped: number
      /** 확인 필요 박스 수(포장 목록의 '확인 필요' 타일과 같은 기준). */
      problemBoxes: number
      byProblem: Partial<Record<PackingProblem, number>>
      list: PackingBox[]
    }
  | { ok: false; shipDate: string; error: string }

type Db = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

export async function loadPackingWeek(db: Db, shipDate: string, now: Date = new Date()): Promise<PackingWeek> {
  const fail = (error: string): PackingWeek => ({ ok: false, shipDate, error })
  const chargedBumpDate = addDaysKst(shipDate, 14)

  const { data: subsRaw, error: subsErr } = await db
    .from('subscriptions')
    .select(
      'id, dog_id, user_id, status, fresh_ratio, next_delivery_date, has_billing_key, requires_billing_key_renewal, last_failed_charge_at, total_amount',
    )
    .in('status', ['active', 'paused'])
    .or(`next_delivery_date.lte.${shipDate},next_delivery_date.eq.${chargedBumpDate}`)
    .order('created_at', { ascending: true })
  if (subsErr) return fail(`구독 조회 실패: ${subsErr.message}`)
  const subs = ((subsRaw ?? []) as unknown) as SubRow[]

  // 청구된 박스는 날짜가 어떻게 바뀌어도 목록에 남는다(포장 목록과 같은 역추적 — 결제됨 + preparing 주문).
  const subIdSet = new Set(subs.map((s) => s.id))
  const { data: strayOrders, error: strayErr } = await db
    .from('orders')
    .select('subscription_id')
    .in('payment_status', PAID_STATUSES)
    .eq('order_status', 'preparing')
    .not('subscription_id', 'is', null)
  if (strayErr) return fail(`발송 대기 주문 조회 실패: ${strayErr.message}`)
  const movedIds = [
    ...new Set(
      ((strayOrders ?? []) as Array<{ subscription_id: string | null }>)
        .map((o) => o.subscription_id)
        .filter((id): id is string => id != null && !subIdSet.has(id)),
    ),
  ]
  const movedSubIds = new Set<string>()
  if (movedIds.length > 0) {
    const { data: movedRaw, error: movedErr } = await selectInChunks(movedIds, (chunk) =>
      db
        .from('subscriptions')
        .select(
          'id, dog_id, user_id, status, fresh_ratio, next_delivery_date, has_billing_key, requires_billing_key_renewal, last_failed_charge_at, total_amount',
        )
        .in('id', chunk),
    )
    if (movedErr) return fail(`일정 이동 구독 조회 실패: ${movedErr.message}`)
    for (const m of ((movedRaw ?? []) as unknown) as SubRow[]) {
      subs.push(m)
      movedSubIds.add(m.id)
    }
  }

  const subIds = subs.map((s) => s.id)
  const dogIds = [...new Set(subs.map((s) => s.dog_id).filter(Boolean))] as string[]

  // 결제 증거 — 이번 회차에 보낸 주문(발송일 6일 전 이후) · 결제됨 + preparing 주문. 실패하면 숫자를 내지 않는다(규칙190).
  const shippedSubIds = new Set<string>()
  const orderBySubId = new Map<string, true>()
  if (subIds.length > 0) {
    const shippedSince = `${addDaysKst(shipDate, -6)}T00:00:00+09:00`
    const { data: shippedRows, error: shippedErr } = await selectInChunks(subIds, (chunk) =>
      db
        .from('orders')
        .select('subscription_id')
        .in('subscription_id', chunk)
        .in('payment_status', PAID_STATUSES)
        .in('order_status', ['shipping', 'delivered'])
        .gte('shipped_at', shippedSince),
    )
    if (shippedErr) return fail(`발송한 주문 조회 실패: ${shippedErr.message}`)
    for (const o of (shippedRows ?? []) as Array<{ subscription_id: string | null }>) {
      if (o.subscription_id) shippedSubIds.add(o.subscription_id)
    }
    const { data: orderRows, error: ordersErr } = await selectInChunks(subIds, (chunk) =>
      db
        .from('orders')
        .select('subscription_id')
        .in('subscription_id', chunk)
        .in('payment_status', PAID_STATUSES)
        .eq('order_status', 'preparing'),
    )
    if (ordersErr) return fail(`발송 대기 주문 조회 실패: ${ordersErr.message}`)
    for (const o of (orderRows ?? []) as Array<{ subscription_id: string | null }>) {
      if (o.subscription_id) orderBySubId.set(o.subscription_id, true)
    }
  }

  // 결제일(구독마다 다르다 — 서포터즈 체험 구간 = 화, 그 밖 = 토). 체험 상태를 모르면 숫자를 내지 않는다.
  const nowForCharge = now
  const timingByUser = new Map<string, ChargeTiming>()
  {
    const userIds = [...new Set(subs.map((s) => s.user_id))]
    if (userIds.length > 0) {
      const { data: trialRows, error: trialErr } = await selectInChunks(userIds, (chunk) =>
        db.from('subscription_trials').select('user_id, cheap_remaining, half_remaining').in('user_id', chunk),
      )
      if (trialErr) return fail(`서포터즈 상태 조회 실패: ${trialErr.message}`)
      for (const t of (trialRows ?? []) as Array<{ user_id: string; cheap_remaining: number; half_remaining: number }>) {
        timingByUser.set(t.user_id, chargeTimingFor(t))
      }
    }
  }
  const timingOf = (userId: string): ChargeTiming => timingByUser.get(userId) ?? chargeTimingFor(null)

  // 가격 인상 회차인데 동의 기록이 없는 박스 — 청구 크론이 보류한다(포장 목록과 같은 펼치기, 2026-10-14 A1 병합 때 맞춤).
  //   못 읽으면 숫자를 내지 않는다(포장 목록이 목록을 멈추는 것과 같은 판단).
  const nextRoundBySub = new Map<string, ProjectedRound>()
  {
    const chargeable = subs.filter(
      (s) =>
        s.status === 'active' &&
        s.has_billing_key &&
        s.requires_billing_key_renewal !== true &&
        s.next_delivery_date != null,
    )
    if (chargeable.length > 0) {
      const fromIso = nextChargeRunDate(now)
      const until = [addDaysKst(shipDate, 28), addDaysKst(fromIso, 28)].sort().at(-1)!
      const proj = await loadChargeProjection(
        db,
        chargeable.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          next_delivery_date: s.next_delivery_date,
          total_amount: s.total_amount,
        })),
        { fromIso, untilChargeIso: until, stopAtHold: true },
      )
      if (!proj.ok) return fail(`결제 예정액·가격 인상 동의 조회 실패: ${proj.error}`)
      for (const rs of proj.roundsByUser.values()) {
        for (const r of rs) if (!nextRoundBySub.has(r.subId)) nextRoundBySub.set(r.subId, r)
      }
    }
  }

  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const [dogsRes, formulasRes, prodRes, prodAllRes] = await Promise.all([
    selectInChunks(dogIds, (chunk) => db.from('dogs').select('id, name').in('id', chunk)),
    selectInChunks(dogIds, (chunk) =>
      db
        .from('dog_formulas')
        .select('id, dog_id, cycle_number, formula, daily_kcal, approval_status, applied_from, created_at')
        .in('dog_id', chunk)
        .order('created_at', { ascending: false }),
    ),
    db
      .from('products')
      .select('slug, name, price, sale_price, stock, is_subscribable')
      .in('slug', allSlugs)
      .eq('is_active', true),
    db.from('products').select('slug, name, price, sale_price, stock, is_subscribable, is_active').in('slug', allSlugs),
  ])
  const lookupErr = dogsRes.error ?? formulasRes.error ?? prodRes.error ?? prodAllRes.error
  if (lookupErr) return fail(`처방·강아지·상품 조회 실패: ${lookupErr.message}`)

  const dogNames = new Map<string, string>()
  for (const d of (dogsRes.data ?? []) as Array<{ id: string; name: string }>) dogNames.set(d.id, d.name)
  // 강아지별 이 발송일에 담을 처방 — 승인 대기·거절·시작 전 제외, created_at 최신(정본 servingFormulaByDog).
  const formulaByDog = servingFormulaByDog(((formulasRes.data ?? []) as unknown) as FormulaRow[], shipDate)

  const blocks = await loadBlockedLinesByDog(db, dogIds)
  if (!blocks.ok) return fail(`설문(알레르기) 조회 실패: ${blocks.error}`)

  const products: Record<string, PickProduct> = {}
  for (const p of ((prodRes.data ?? []) as unknown) as PickProduct[]) products[p.slug] = p
  const productsAll: Record<string, PickProduct & { is_active: boolean | null }> = {}
  for (const p of ((prodAllRes.data ?? []) as unknown) as Array<PickProduct & { is_active: boolean | null }>) {
    productsAll[p.slug] = p
  }

  const list: PackingBox[] = subs.map((sub) => {
    const f = sub.dog_id ? formulaByDog.get(sub.dog_id) : undefined
    const freshRatio = sub.fresh_ratio
    const freshUnknown = freshRatio == null
    let held: unknown[] = []
    let missingCount = 0
    if (f && !freshUnknown) {
      const boxInput = {
        formula: {
          lineRatios: f.formula.lineRatios,
          toppers: f.formula.toppers ?? { vegetable: 0, protein: 0 },
          dailyKcal: f.daily_kcal,
        },
        freshRatio,
        blockedLines: (sub.dog_id && blocks.byDog.get(sub.dog_id)) || [],
      }
      const plan = computeBoxPlan({ ...boxInput, products })
      held = plan.held
      const items = subscribableItems(plan.items)
      const packedSlugs = new Set(items.map((it) => it.product.slug))
      missingCount = computeBoxItems({ ...boxInput, products: productsAll }).filter(
        (it) => !packedSlugs.has(it.product.slug),
      ).length
    }
    const shipped = shippedSubIds.has(sub.id) ? true : null
    // ↓ 판정 입력 — 포장 목록(page.tsx)과 글자 그대로 같은 식(규칙249 대조).
    const hasPaidOrder = orderBySubId.has(sub.id) || shipped !== null
    const upcomingRound = nextRoundBySub.get(sub.id) ?? null
    const nextRound = hasPaidOrder || !upcomingRound || upcomingRound.shipIso > shipDate ? null : upcomingRound
    const flags = {
      alreadyShipped: shipped,
      pausedAfterCharge: sub.status === 'paused' && orderBySubId.has(sub.id),
      pausedBeforeCharge: sub.status === 'paused' && !hasPaidOrder,
      dateMovedAfterCharge: movedSubIds.has(sub.id),
      cannotCharge:
        !sub.has_billing_key || sub.requires_billing_key_renewal === true,
      skippedNotCharged:
        sub.status === 'active' &&
        sub.next_delivery_date === chargedBumpDate &&
        !hasPaidOrder,
      overdueNotCharged:
        sub.next_delivery_date != null &&
        sub.next_delivery_date < shipDate &&
        !hasPaidOrder,
      notChargedAfterRun:
        chargeRunPassed(chargeDateFor(shipDate, timingOf(sub.user_id)), nowForCharge) &&
        sub.status === 'active' &&
        sub.next_delivery_date != null &&
        sub.next_delivery_date <= shipDate &&
        !hasPaidOrder,
      chargeFailedToday:
        sub.last_failed_charge_at != null &&
        kstDateOf(sub.last_failed_charge_at) === todayKstIsoDate(),
      priceConsentMissing: !hasPaidOrder && (nextRound?.held ?? false),
      held,
    }
    const block = shipBlockReason(flags)
    // '확인 필요' = 포장 목록 page.tsx 의 problemCount 와 같은 항목(행마다 하나라도 참이면 확인 필요 박스).
    const problems: PackingProblem[] = []
    if (!f) problems.push('no_formula')
    if (freshUnknown) problems.push('fresh_unknown')
    // 예정일이 지났는데 결제 증거는 있는 박스(결제 증거가 없으면 아래 overdueNotCharged 가 잡는다).
    if (sub.next_delivery_date != null && sub.next_delivery_date < shipDate && hasPaidOrder) problems.push('overdue_paid')
    if (flags.cannotCharge) problems.push('cannot_charge')
    if (flags.chargeFailedToday) problems.push('charge_failed_today')
    if (flags.pausedBeforeCharge) problems.push('paused_before_charge')
    if (flags.skippedNotCharged) problems.push('skipped_not_charged')
    if (flags.priceConsentMissing) problems.push('price_consent_missing')
    if (flags.overdueNotCharged) problems.push('overdue_not_charged')
    if (flags.notChargedAfterRun) problems.push('not_charged_after_run')
    if (flags.pausedAfterCharge) problems.push('paused_after_charge')
    if (flags.dateMovedAfterCharge) problems.push('date_moved_after_charge')
    if (missingCount > 0) problems.push('missing_items')
    if (held.length > 0) problems.push('allergy_check_needed')
    return {
      subId: sub.id,
      dogName: (sub.dog_id && dogNames.get(sub.dog_id)) || '(강아지 미상)',
      block,
      problems,
    }
  })

  const byProblem: Partial<Record<PackingProblem, number>> = {}
  for (const b of list) for (const p of b.problems) byProblem[p] = (byProblem[p] ?? 0) + 1
  return {
    ok: true,
    shipDate,
    boxes: list.length,
    shippable: list.filter((b) => b.block === null).length,
    alreadyShipped: list.filter((b) => b.block === 'already_shipped').length,
    problemBoxes: list.filter((b) => b.problems.length > 0).length,
    byProblem,
    list,
  }
}

/** 확인 필요 사유를 많은 순으로 — '사유별 N' 한 줄. */
export function packingProblemLines(byProblem: Partial<Record<PackingProblem, number>>): Array<{ problem: PackingProblem; label: string; count: number }> {
  return (Object.entries(byProblem) as Array<[PackingProblem, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([problem, count]) => ({ problem, label: PACKING_PROBLEM_LABEL[problem], count }))
}

/** CSV·화면의 발송 금지 라벨(ship-block 정본) — 확인용으로 다시 내보낸다. */
export { SHIP_BLOCK_LABEL }
