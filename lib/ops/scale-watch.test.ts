import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scaleWarnings, SCALE_LIMITS } from './scale-watch.ts'

describe('scaleWarnings — 한도에 다가가면 미리 알린다', () => {
  it('지금 규모(구독 1·처방 12·주문 2)는 경보 없음', () => {
    assert.deepEqual(
      scaleWarnings({ activeBilledSubs: 1, formulas: 12, paidOrders: 2, ledgerRows365d: 5 }),
      [],
    )
  })
  it('경보 지점에 닿으면 그 항목만', () => {
    const w = scaleWarnings({ activeBilledSubs: 40, formulas: 12, paidOrders: 2, ledgerRows365d: 5 })
    assert.equal(w.length, 1)
    assert.match(w[0]!, /활성 구독 40/)
  })
  it('조회 실패(null)는 경보로 만들지 않는다', () => {
    assert.deepEqual(
      scaleWarnings({ activeBilledSubs: null, formulas: null, paidOrders: null, ledgerRows365d: null }),
      [],
    )
  })
  it('경보 지점은 실제 한도보다 충분히 앞(≤ 60%)', () => {
    const hard: Record<string, number> = { activeBilledSubs: 70, formulas: 300, paidOrders: 1000, ledgerRows365d: 1000 }
    for (const l of SCALE_LIMITS) assert.ok(l.warnAt <= hard[l.key]! * 0.6, `${l.key} 경보가 너무 늦다`)
  })
})
