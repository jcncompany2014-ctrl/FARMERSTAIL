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
    // R101: 결제 캡처가 한 번도 없던(=ledger 순합 0) cancelled 주문은 "결제
    // 미완료 만료/취소" 라 net 도 0 이어야 한다. 이전엔 total_amount 가 남아
    // orderNet=total → ledger(0) 과 불일치로 매주 가짜 mismatch 를 쏟아 진짜
    // 불일치를 묻었다 (order-expire 가 pending→cancelled 로 바꾸되 total 은
    // 보존하고 payment_events 엔 amount=0 만 기록하기 때문). 결제 후 전액환불
    // cancelled 는 ledger=0 이면서 total-refunded=0 이라 어차피 0 — 영향 없음.
    const orderNet =
      o.payment_status === 'cancelled' && ledger === 0 ? 0 : total - refunded
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
