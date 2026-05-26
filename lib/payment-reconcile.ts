/**
 * R69 — payment_events 정합성 검증 helper (cron 로직 분리, 테스트 가능하게).
 *
 * 순수 함수만 (DB 호출 X). cron route 가 fetch 후 본 함수 호출.
 */

export interface OrderSnapshot {
  id: string
  payment_status: string | null
  total_amount: number | null
  refunded_amount: number | null
}

export interface LedgerEvent {
  order_id: string
  amount: number
}

export interface Mismatch {
  orderId: string
  status: string
  orderNetExpected: number
  ledgerBalance: number
  diff: number
}

/**
 * 주문 snapshot vs 원장 balance 정합성 비교.
 *
 * orders 의 net 잔액 = total_amount - refunded_amount.
 * payment_events SUM = ledger balance.
 * 둘이 다르면 mismatch.
 */
export function findLedgerMismatches(
  orders: OrderSnapshot[],
  events: LedgerEvent[],
): Mismatch[] {
  const balanceByOrder = new Map<string, number>()
  for (const e of events) {
    balanceByOrder.set(
      e.order_id,
      (balanceByOrder.get(e.order_id) ?? 0) + e.amount,
    )
  }

  const mismatches: Mismatch[] = []
  for (const o of orders) {
    const ledger = balanceByOrder.get(o.id) ?? 0
    const total = o.total_amount ?? 0
    const refunded = o.refunded_amount ?? 0
    const orderNet = total - refunded
    if (ledger !== orderNet) {
      mismatches.push({
        orderId: o.id,
        status: o.payment_status ?? 'unknown',
        orderNetExpected: orderNet,
        ledgerBalance: ledger,
        diff: ledger - orderNet,
      })
    }
  }
  return mismatches
}
