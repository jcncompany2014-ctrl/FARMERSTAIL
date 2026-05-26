/**
 * R60 — 결제 원장 (payment_events) helper.
 *
 * 모든 결제 상태 변경 시 이 함수로 한 줄 insert. orders.status 의 UPDATE
 * 와 같이 호출되어 이력 영원히 남김.
 *
 * # 불변성 보장
 *  - DB trigger 가 UPDATE/DELETE 차단 (block_payment_events_mutations).
 *  - service_role 만 INSERT (RLS — anon/authenticated INSERT policy 없음).
 *
 * # 호출 패턴
 *  ```ts
 *  // 1. orders.status 변경
 *  await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', orderId)
 *  // 2. 같이 event 한 줄 insert (best-effort, 실패해도 결제 흐름 막지 X)
 *  await recordPaymentEvent(supabase, {
 *    orderId,
 *    paymentKey,
 *    eventType: 'paid',
 *    amount: 35000,
 *    prevStatus: 'pending',
 *    newStatus: 'paid',
 *    source: 'user_checkout',
 *  })
 *  ```
 *
 * # 환불 패턴 — 음수 amount
 *  ```ts
 *  await recordPaymentEvent(supabase, {
 *    orderId,
 *    paymentKey,
 *    eventType: 'refunded',
 *    amount: -35000,  // 음수
 *    prevStatus: 'paid',
 *    newStatus: 'refunded',
 *    source: 'user_cancel',
 *  })
 *  // → 같은 orderId 의 SUM(amount) = 0 → 완전 환불 검증
 *  ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentEventType =
  | 'paid'
  | 'refunded'
  | 'partial_refunded'
  | 'failed'
  | 'cancel_requested'
  | 'webhook_received'
  | 'admin_action'
  | 'cron_refund_queue'

export type PaymentEventSource =
  | 'user_checkout'
  | 'toss_webhook'
  | 'user_cancel'
  | 'partial_cancel'
  | 'cron_refund_queue'
  | 'cron_subscription_charge'
  | 'cron_order_expire'
  | 'admin_panel'

export interface PaymentEventInput {
  orderId: string
  paymentKey?: string | null
  eventType: PaymentEventType
  /** 양수 = 결제 / 음수 = 환불 / 0 = 정보성. SUM = 현재 잔액. */
  amount: number
  prevStatus?: string | null
  newStatus?: string | null
  source: PaymentEventSource
  metadata?: Record<string, unknown> | null
  /** 누가 했는지 (webhook / cron 은 null) */
  actorUserId?: string | null
}

/**
 * 결제 원장에 한 줄 insert. Best-effort — 실패해도 throw 안 함
 * (결제 흐름 막지 않으려고). 대신 Sentry 에 캡쳐.
 *
 * @returns ok / fail (호출처가 알 필요 있으면)
 */
export async function recordPaymentEvent(
  supabase: SupabaseClient,
  input: PaymentEventInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    // generated types 에 아직 payment_events 없음 (방금 migration) → cast 우회.
    const { error } = await (
      supabase.from('payment_events' as never) as unknown as {
        insert: (
          v: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      }
    ).insert({
      order_id: input.orderId,
      payment_key: input.paymentKey ?? null,
      event_type: input.eventType,
      amount: input.amount,
      prev_status: input.prevStatus ?? null,
      new_status: input.newStatus ?? null,
      source: input.source,
      metadata: input.metadata ?? null,
      actor_user_id: input.actorUserId ?? null,
    })

    if (error) return { ok: false, reason: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown' }
  }
}

/**
 * 주문 1건의 잔액 (SUM of amounts) 계산. 0 이면 완전 환불, 양수면 결제됨.
 *
 * Server / admin 전용. RLS 가 본인 주문 만 SELECT 허용.
 */
export async function getOrderPaymentBalance(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ balance: number; events: number }> {
  const client = supabase.from('payment_events' as never) as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{
        data: Array<{ amount: number }> | null
        error: { message: string } | null
      }>
    }
  }
  const { data } = await client.select('amount').eq('order_id', orderId)
  const events = data ?? []
  const balance = events.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  return { balance, events: events.length }
}
