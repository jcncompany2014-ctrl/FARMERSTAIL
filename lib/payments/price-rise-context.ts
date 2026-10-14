/**
 * 가격 인상 판정에 필요한 DB 상태 읽기·보류 기록 — 서버 전용(service_role). 판정 순수함수는 lib/payments/price-rise.ts.
 * (분리 이유: node --test 는 @/ 별칭을 못 읽는다 — trial-state.ts 와 같은 관례)
 *
 * 청구 크론·어드민 화면·포장 목록이 **같은 읽기**를 쓴다 — 어떤 결제를 '앞 회차'로 보는지가 화면마다 다르면
 * 화면은 '보류 예정'인데 크론은 청구하는(또는 그 반대) 일이 생긴다.
 *
 * AGENTS 규칙1·8: service_role 로 읽고 범위는 `.in('user_id', …)` 로 코드가 책임진다. 조회 실패는 ok:false —
 * 호출부는 '인상 아님'으로 접지 않는다(모르면 긁지 않는다 / 목록을 믿을 수 없다고 말한다).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import type { TrialState } from './trial'
import { phaseFromDiscountReason, type PriceConsentRow, type PricePhase, type PriceRise } from './price-rise'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export type PriceRiseContext = {
  /** 체험 도장 — 없으면 정상가 고객(판정 대상 아님). */
  trial: TrialState | null
  /** 바로 앞에 결제된(돈이 남아 있는) 정기배송 회차의 가격 구간. 결제가 없으면 null. */
  lastPaidPhase: PricePhase | null
  /** 유효한(취소 안 된) 동의 기록. */
  consents: PriceConsentRow[]
}

/**
 * 사람들의 인상 판정 상태. 체험 도장이 없는 사람은 주문·동의를 읽지 않는다(정상가 고객 영향 0).
 * '앞 회차' = 그 사람의 정기배송 주문 중 돈이 남아 있는 것(PAID_STATUSES — 전액 환불은 회차가 되돌아가므로 뺀다)의 가장 최근.
 */
export async function loadPriceRiseContext(
  admin: AnyClient,
  userIds: readonly string[],
): Promise<{ ok: true; byUser: Map<string, PriceRiseContext> } | { ok: false; error: string }> {
  const ids = [...new Set(userIds)]
  const byUser = new Map<string, PriceRiseContext>()
  for (const id of ids) byUser.set(id, { trial: null, lastPaidPhase: null, consents: [] })
  if (ids.length === 0) return { ok: true, byUser }

  const trials = await selectInChunks(ids, (chunk) =>
    admin
      .from('subscription_trials')
      .select('user_id, cheap_remaining, half_remaining, cheap_price, half_rate')
      .in('user_id', chunk),
  )
  if (trials.error) return { ok: false, error: `subscription_trials: ${trials.error.message}` }
  const trialUsers: string[] = []
  for (const t of trials.data as Array<TrialState & { user_id: string }>) {
    const ctx = byUser.get(t.user_id)
    if (!ctx) continue
    ctx.trial = {
      cheap_remaining: Number(t.cheap_remaining),
      half_remaining: Number(t.half_remaining),
      cheap_price: Number(t.cheap_price),
      half_rate: Number(t.half_rate),
    }
    trialUsers.push(t.user_id)
  }
  if (trialUsers.length === 0) return { ok: true, byUser }

  const [orders, consents] = await Promise.all([
    selectInChunks(trialUsers, (chunk) =>
      admin
        .from('orders')
        .select('user_id, discount_reason, paid_at, created_at')
        .in('user_id', chunk)
        .not('subscription_id', 'is', null)
        .in('payment_status', [...PAID_STATUSES]),
    ),
    selectInChunks(trialUsers, (chunk) =>
      admin
        .from('subscription_price_consents')
        .select('id, user_id, rise, consented_on, channel, memo, revoked_at, recorded_by, created_at')
        .in('user_id', chunk)
        .is('revoked_at', null),
    ),
  ])
  if (orders.error) return { ok: false, error: `orders: ${orders.error.message}` }
  if (consents.error) return { ok: false, error: `subscription_price_consents: ${consents.error.message}` }

  // 사람마다 가장 최근 결제 — paid_at(없으면 created_at) 기준. 묶음마다 정렬되므로 여기서 다시 고른다.
  const latest = new Map<string, { at: string; reason: string | null }>()
  for (const o of orders.data as Array<{
    user_id: string
    discount_reason: string | null
    paid_at: string | null
    created_at: string
  }>) {
    const at = o.paid_at ?? o.created_at
    const cur = latest.get(o.user_id)
    if (!cur || at > cur.at) latest.set(o.user_id, { at, reason: o.discount_reason })
  }
  for (const [userId, l] of latest) {
    const ctx = byUser.get(userId)
    if (ctx) ctx.lastPaidPhase = phaseFromDiscountReason(l.reason)
  }
  for (const c of consents.data as Array<PriceConsentRow & { user_id: string }>) {
    byUser.get(c.user_id)?.consents.push(c)
  }
  return { ok: true, byUser }
}

/**
 * 보류 기록 — 청구 크론 전용. 처음이면 새 행(created: true → 호출부가 Sentry error 를 한 번 올린다),
 * 이미 보류 중이면 last_held_at 만 갱신한다(매일 같은 알림이 쌓이지 않게).
 */
export async function recordPriceRiseHold(
  admin: AnyClient,
  hold: {
    subscriptionId: string
    userId: string
    shipDate: string
    chargeDate: string
    rise: PriceRise
    chargeAmount: number
    listAmount: number
  },
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString()
  const { error } = await admin.from('subscription_charge_holds').insert({
    subscription_id: hold.subscriptionId,
    user_id: hold.userId,
    ship_date: hold.shipDate,
    charge_date: hold.chargeDate,
    reason: 'price_rise_consent_missing',
    rise: hold.rise,
    charge_amount: hold.chargeAmount,
    list_amount: hold.listAmount,
    first_held_at: nowIso,
    last_held_at: nowIso,
  })
  if (!error) return { ok: true, created: true }
  if ((error as { code?: string }).code !== '23505') return { ok: false, error: error.message }
  const { data, error: updErr } = await admin
    .from('subscription_charge_holds')
    .update({ last_held_at: nowIso, charge_amount: hold.chargeAmount, list_amount: hold.listAmount })
    .eq('subscription_id', hold.subscriptionId)
    .eq('ship_date', hold.shipDate)
    .eq('reason', 'price_rise_consent_missing')
    .is('resolved_at', null)
    .select('id')
  if (updErr) return { ok: false, error: updErr.message }
  // 0행 = 충돌했는데 열린 보류가 없다(그 사이 풀림) — 기록은 못 했지만 청구하지 않은 사실은 그대로다.
  if ((data?.length ?? 0) === 0) return { ok: false, error: 'hold_conflict_without_open_row' }
  return { ok: true, created: false }
}

/** 청구 성공 뒤 그 구독의 열린 보류를 닫는다 — 청구 크론 전용. */
export async function resolvePriceRiseHolds(
  admin: AnyClient,
  subscriptionId: string,
): Promise<{ ok: true; closed: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from('subscription_charge_holds')
    .update({ resolved_at: new Date().toISOString(), resolved_reason: 'charged' })
    .eq('subscription_id', subscriptionId)
    .is('resolved_at', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, closed: data?.length ?? 0 }
}
