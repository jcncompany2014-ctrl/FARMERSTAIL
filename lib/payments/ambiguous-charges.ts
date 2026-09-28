import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types.ts'
import { needsOutcomeCheck, isMerchantAuthError } from './billing-error-classify.ts'
import { orderPaymentOutcome, type TossPayment, type TossError } from './toss.ts'

/** 청구 크론이 넣어 주는 바깥 의존성 — 테스트는 가짜를 넣는다(lib/payments/ambiguous-charges.test.ts). */
export type AmbiguousDeps = {
  /** 토스 주문번호 조회 — 실제는 lib/payments/toss lookupPaymentByOrderId. */
  lookup: (
    orderId: string,
  ) => Promise<{ found: true; payment: TossPayment } | { found: false } | { found: null; error: TossError }>
  /** 사장님 경보 — 실제는 captureBusinessEvent. */
  report: (level: 'info' | 'warning' | 'error', message: string, context: Record<string, string | number | boolean | null | undefined>) => void
}

/**
 * ★결과 불명 자동결제 확정 (2026-09-28 출시 전 점검 9차).
 *
 * 타임아웃·토스 5xx 처럼 **돈이 나갔는지 모르는** 실패는 다음 시도를 같은 멱등키로만 믿으면 이중청구가 난다:
 *   ① 토스 멱등키는 (API 키·주소·메서드) 단위 — 카드 재등록(빌링키 = 청구 주소) 뒤엔 같은 키도 **새 청구**
 *   ② 시도마다 새 주문번호라 토스의 주문번호 중복 방어도 안 걸린다
 *   ③ 건너뛰기·재개·재등록으로 회차 날짜가 바뀌면 키 자체가 바뀐다
 *   ④ 고객이 해지하면 빌링키가 지워져 아무도 다시 보지 않는다 — 돈만 빠지고 박스·환불·경보 0
 * 그래서 매 실행 **맨 앞에서** 그런 시도를 토스 주문번호 조회로 확정한다:
 *   · 결제돼 있음(held)  → 그 청구 행을 status=pending + payment_key 로 되돌린다 → 아래 루프의 기존
 *                          '미확정 청구' 가드가 그 구독을 막고, 사장님께 경보(주문 채택 또는 토스 환불).
 *                          해지·정지된 구독도 여기서 잡힌다.
 *   · 없음(none)         → 확인 표시 + 멱등키 앵커(charge_key_seq)를 올려 다음 시도는 새 키(돈 안 나감 확정).
 *   · 진행 중·조회 실패  → **모른다** → 이번 실행에서 그 구독은 청구하지 않는다.
 * 앞서 결제됨으로 되돌려 둔 행은 매일 다시 보고, 토스에서 환불(CANCELED)됐으면 가드를 푼다.
 */
export async function verifyAmbiguousCharges(
  supabase: SupabaseClient<Database>,
  deps: AmbiguousDeps,
): Promise<{
  unresolvedSubIds: Set<string>
  checked: number
  held: number
  released: number
  unknown: number
  abort: string | null
}> {
  const out = {
    unresolvedSubIds: new Set<string>(),
    checked: 0,
    held: 0,
    released: 0,
    unknown: 0,
    abort: null as string | null,
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // 청구 도중 함수가 끊겨(시간 초과·배포) 결제키 없이 '진행 중'으로 남은 행 — 1시간 지난 것만(지금 실행과 겹치지 않게).
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await supabase
    .from('subscription_charges')
    .select('id, subscription_id, order_id, status, error_code, payment_key, toss_verified_at')
    .gte('attempted_at', since)
    .not('order_id', 'is', null)
    .or(
      'and(status.eq.failed,toss_verified_at.is.null),' +
        'and(status.eq.pending,toss_verified_at.not.is.null),' +
        `and(status.eq.pending,payment_key.is.null,toss_verified_at.is.null,attempted_at.lt.${staleBefore})`,
    )
    .order('attempted_at', { ascending: true })
    .limit(50)
  if (error) {
    // 어느 구독에 결과 불명 시도가 있는지 **모른다** — 모르면 긁지 않는다.
    out.abort = 'ambiguous_lookup_failed'
    deps.report('error', 'subscription.charge.ambiguous_scan_failed', { dbError: error.message })
    return out
  }
  const list = (rows ?? []) as Array<{
    id: string
    subscription_id: string
    order_id: string
    status: string
    error_code: string | null
    payment_key: string | null
    toss_verified_at: string | null
  }>
  const nowIso = new Date().toISOString()
  // 돈이 안 나간 게 보장된 실패(카드 거절·확정 거절·우리 설정 오류)는 조회 없이 확인 표시만.
  const settled = list.filter((r) => r.status === 'failed' && !needsOutcomeCheck(r.error_code)).map((r) => r.id)
  if (settled.length > 0) {
    const { error: markErr } = await supabase
      .from('subscription_charges')
      .update({ toss_verified_at: nowIso })
      .in('id', settled)
      .eq('status', 'failed')
    if (markErr) {
      deps.report('warning', 'subscription.charge.ambiguous_mark_failed', { dbError: markErr.message })
    }
  }
  const toCheck = list.filter((r) => r.status === 'pending' || needsOutcomeCheck(r.error_code))
  if (toCheck.length === 0) return out
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('id, order_number')
    .in('id', toCheck.map((r) => r.order_id))
  if (ordErr) {
    for (const r of toCheck) out.unresolvedSubIds.add(r.subscription_id)
    out.unknown += toCheck.length
    deps.report('error', 'subscription.charge.ambiguous_order_lookup_failed', { dbError: ordErr.message })
    return out
  }
  const numberById = new Map((orders ?? []).map((o) => [o.id as string, o.order_number as string]))

  for (const r of toCheck) {
    const orderNumber = numberById.get(r.order_id)
    if (!orderNumber) {
      out.unresolvedSubIds.add(r.subscription_id)
      out.unknown++
      continue
    }
    out.checked++
    const found = await deps.lookup(orderNumber)
    if (found.found === null) {
      out.unresolvedSubIds.add(r.subscription_id)
      out.unknown++
      if (isMerchantAuthError(found.error.code)) {
        // 조회조차 인증 거부 — 키가 틀렸다. 청구해도 전원 같은 이유로 실패한다.
        out.abort = 'toss_unauthorized'
        return out
      }
      continue
    }
    const outcome = found.found ? orderPaymentOutcome(found.payment.status) : 'none'
    if (outcome === 'pending') {
      out.unresolvedSubIds.add(r.subscription_id)
      out.unknown++
      continue
    }

    if (r.status === 'pending' && !r.toss_verified_at) {
      // 끊긴 채 남은 '진행 중' 행 — 결제됐으면 결제키를 붙여 기존 미확정 가드가 막게 하고, 아니면 실패로 닫는다.
      if (outcome === 'held' && found.found) {
        await supabase
          .from('subscription_charges')
          .update({ payment_key: found.payment.paymentKey, toss_verified_at: nowIso })
          .eq('id', r.id)
          .eq('status', 'pending')
        out.unresolvedSubIds.add(r.subscription_id)
        out.held++
        deps.report('error', 'subscription.charge.stale_pending_captured', {
          subscriptionId: r.subscription_id,
          chargeId: r.id,
          orderNumber,
          paymentKey: found.payment.paymentKey,
          note: '청구 도중 끊긴 행이 토스에선 결제됨 — 주문을 결제됨으로 채택해 발송하거나 토스에서 환불할 것',
        })
      } else {
        await supabase
          .from('subscription_charges')
          .update({ status: 'failed', error_code: 'INTERRUPTED_NOT_CHARGED', toss_verified_at: nowIso })
          .eq('id', r.id)
          .eq('status', 'pending')
      }
      continue
    }

    if (r.status === 'pending') {
      // 앞서 '결제됨'으로 되돌려 둔 행 — 토스에서 환불(CANCELED)됐으면 가드를 푼다.
      if (outcome === 'none') {
        const { error: relErr } = await supabase
          .from('subscription_charges')
          .update({ status: 'failed', toss_verified_at: nowIso })
          .eq('id', r.id)
          .eq('status', 'pending')
        if (!relErr) {
          out.released++
          deps.report('info', 'subscription.charge.ambiguous_released', {
            subscriptionId: r.subscription_id,
            chargeId: r.id,
            orderNumber,
          })
        }
      }
      continue
    }

    if (outcome === 'held' && found.found) {
      const pk = found.payment.paymentKey
      // 같은 결제가 이미 다른 주문에 기록됐나(멱등키 재생 성공이 이번 주문에 붙은 경우) — 그러면 문제없다.
      const { data: dup, error: dupErr } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_key', pk)
        .limit(1)
      if (dupErr) {
        out.unresolvedSubIds.add(r.subscription_id)
        out.unknown++
        continue
      }
      if ((dup ?? []).length > 0) {
        await supabase.from('subscription_charges').update({ toss_verified_at: nowIso }).eq('id', r.id).eq('status', 'failed')
        continue
      }
      const { error: heldErr } = await supabase
        .from('subscription_charges')
        .update({ status: 'pending', payment_key: pk, toss_verified_at: nowIso })
        .eq('id', r.id)
        .eq('status', 'failed')
      out.unresolvedSubIds.add(r.subscription_id)
      out.held++
      deps.report('error', 'subscription.charge.ambiguous_captured', {
        subscriptionId: r.subscription_id,
        chargeId: r.id,
        orderId: r.order_id,
        orderNumber,
        paymentKey: pk,
        tossStatus: found.payment.status,
        amount: found.payment.totalAmount,
        writeError: heldErr?.message ?? null,
        note:
          '토스에선 결제됐는데 우리 기록은 실패(결과 불명 뒤). 이 구독의 청구는 해결 전까지 막힘 — 주문을 결제됨으로 채택해 발송하거나 토스에서 환불할 것(환불되면 다음 실행이 가드를 푼다)',
      })
      continue
    }

    // 결제 없음 — 확인 표시 + 멱등키 앵커를 올려 다음 시도는 새 키(돈 안 나감이 확정됐으므로 이중청구 위험 0).
    const { error: noneErr } = await supabase
      .from('subscription_charges')
      .update({ toss_verified_at: nowIso })
      .eq('id', r.id)
      .eq('status', 'failed')
    const { data: curSub, error: seqErr } = await supabase
      .from('subscriptions')
      .select('charge_key_seq')
      .eq('id', r.subscription_id)
      .maybeSingle()
    if (!noneErr && !seqErr && curSub) {
      const cur = (curSub as { charge_key_seq: number | null }).charge_key_seq ?? 0
      await supabase
        .from('subscriptions')
        .update({ charge_key_seq: cur + 1 })
        .eq('id', r.subscription_id)
        .eq('charge_key_seq', cur)
    }
  }
  return out
}
