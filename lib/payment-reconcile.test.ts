/**
 * R69 payment-reconcile 단위 테스트. findLedgerMismatches 순수 함수.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  findLedgerMismatches,
  type OrderSnapshot,
  type LedgerEvent,
} from './payment-reconcile.ts'

describe('findLedgerMismatches', () => {
  it('빈 orders → mismatch 0', () => {
    assert.equal(findLedgerMismatches([], []).length, 0)
  })

  it('orders 1건 + 이벤트 일치 (paid 30000) → mismatch 0', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: 'paid', total_amount: 30000, refunded_amount: 0 },
    ]
    const events: LedgerEvent[] = [{ order_id: 'o1', amount: 30000 }]
    assert.equal(findLedgerMismatches(orders, events).length, 0)
  })

  it('orders 잔액과 ledger SUM 일치 (paid 30000 → refunded 30000)', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: 'refunded', total_amount: 30000, refunded_amount: 30000 },
    ]
    const events: LedgerEvent[] = [
      { order_id: 'o1', amount: 30000 },
      { order_id: 'o1', amount: -30000 },
    ]
    assert.equal(findLedgerMismatches(orders, events).length, 0)
  })

  it('orders 잔액 (net=30000) vs ledger (50000) 불일치 → mismatch 1건', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: 'paid', total_amount: 30000, refunded_amount: 0 },
    ]
    const events: LedgerEvent[] = [
      { order_id: 'o1', amount: 30000 },
      { order_id: 'o1', amount: 20000 }, // 이상치 — 잘못된 추가 이벤트
    ]
    const result = findLedgerMismatches(orders, events)
    assert.equal(result.length, 1)
    assert.equal(result[0]!.orderId, 'o1')
    assert.equal(result[0]!.orderNetExpected, 30000)
    assert.equal(result[0]!.ledgerBalance, 50000)
    assert.equal(result[0]!.diff, 20000)
  })

  it('ledger 누락 (orders 는 paid 인데 이벤트 없음) → mismatch 1건', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: 'paid', total_amount: 30000, refunded_amount: 0 },
    ]
    const result = findLedgerMismatches(orders, [])
    assert.equal(result.length, 1)
    assert.equal(result[0]!.ledgerBalance, 0)
    assert.equal(result[0]!.diff, -30000)
  })

  it('부분 환불 정상 (50000 paid, 10000 refund → net 40000, ledger 40000)', () => {
    const orders: OrderSnapshot[] = [
      {
        id: 'o1',
        payment_status: 'partially_refunded',
        total_amount: 50000,
        refunded_amount: 10000,
      },
    ]
    const events: LedgerEvent[] = [
      { order_id: 'o1', amount: 50000 },
      { order_id: 'o1', amount: -10000 },
    ]
    assert.equal(findLedgerMismatches(orders, events).length, 0)
  })

  it('여러 주문 중 1건만 mismatch', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: 'paid', total_amount: 10000, refunded_amount: 0 },
      { id: 'o2', payment_status: 'paid', total_amount: 20000, refunded_amount: 0 },
      { id: 'o3', payment_status: 'paid', total_amount: 30000, refunded_amount: 0 },
    ]
    const events: LedgerEvent[] = [
      { order_id: 'o1', amount: 10000 },
      { order_id: 'o2', amount: 25000 }, // 5000 초과
      { order_id: 'o3', amount: 30000 },
    ]
    const result = findLedgerMismatches(orders, events)
    assert.equal(result.length, 1)
    assert.equal(result[0]!.orderId, 'o2')
    assert.equal(result[0]!.diff, 5000)
  })

  it('null fields → 0 으로 처리', () => {
    const orders: OrderSnapshot[] = [
      { id: 'o1', payment_status: null, total_amount: null, refunded_amount: null },
    ]
    const events: LedgerEvent[] = []
    // null total + null refunded = 0 net. ledger 0. → match.
    assert.equal(findLedgerMismatches(orders, events).length, 0)
  })
})
