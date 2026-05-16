import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { transferBetween, transferToTarget } from './transfers.ts'
import type { FoodLine, Ratio } from './types.ts'

/**
 * lib/personalization/transfers.ts — 라인 mass 이동 헬퍼.
 *
 * 회귀 가드:
 *  - audit C-1/C-5: mass leak 방지 (Math.max(0, ...) 클램프 issue)
 *  - audit #8: protectedLines (BCS 8 + 관절염 시 weight 보호)
 *  - audit #24: self-transfer 차단 (donors 에 to 포함 시 silent skip)
 */

function makeRatios(over: Partial<Record<FoodLine, Ratio>> = {}): Record<
  FoodLine,
  Ratio
> {
  return {
    basic: 0.4,
    weight: 0.1,
    skin: 0.1,
    premium: 0.1,
    joint: 0.3,
    ...over,
  }
}

function sum(r: Record<FoodLine, Ratio>): number {
  return r.basic + r.weight + r.skin + r.premium + r.joint
}

describe('transferBetween', () => {
  it('기본 이동 — basic 0.4 → joint 0.3 + 0.2 = 0.5', () => {
    const r = makeRatios()
    const { ratios, transferred } = transferBetween(r, 'basic', 'joint', 0.2)
    assert.equal(ratios.basic, 0.2)
    assert.ok(Math.abs(ratios.joint - 0.5) < 1e-9)
    assert.equal(transferred, 0.2)
  })

  it('amount > available — 가용량만 이동 (mass leak X)', () => {
    const r = makeRatios({ basic: 0.05 })
    // basic 0.05 만 있는데 0.3 요청
    const { ratios, transferred } = transferBetween(r, 'basic', 'joint', 0.3)
    assert.equal(ratios.basic, 0)
    assert.ok(Math.abs(ratios.joint - 0.35) < 1e-9)
    assert.equal(transferred, 0.05)
  })

  it('audit C-1/C-5 — sum 보존 invariant', () => {
    const r = makeRatios()
    const before = sum(r)
    const { ratios } = transferBetween(r, 'basic', 'joint', 0.15)
    const after = sum(ratios)
    assert.ok(Math.abs(after - before) < 1e-9, `sum drift: ${after} vs ${before}`)
  })

  it('amount = 0 → no-op', () => {
    const r = makeRatios()
    const { ratios, transferred } = transferBetween(r, 'basic', 'joint', 0)
    assert.equal(transferred, 0)
    assert.deepEqual(ratios, r)
  })

  it('amount < 0 → no-op (음수 가드)', () => {
    const r = makeRatios()
    const { ratios, transferred } = transferBetween(r, 'basic', 'joint', -0.1)
    assert.equal(transferred, 0)
    assert.deepEqual(ratios, r)
  })

  it('from === to → no-op (self-transfer 차단)', () => {
    const r = makeRatios()
    const { ratios, transferred } = transferBetween(r, 'basic', 'basic', 0.2)
    assert.equal(transferred, 0)
    assert.deepEqual(ratios, r)
  })

  it('from 가 이미 0 → no-op', () => {
    const r = makeRatios({ basic: 0 })
    const { ratios, transferred } = transferBetween(r, 'basic', 'joint', 0.1)
    assert.equal(transferred, 0)
    assert.deepEqual(ratios, r)
  })

  it('원본 ratios 가 mutate 되지 않음 (immutable)', () => {
    const r = makeRatios()
    const before = { ...r }
    transferBetween(r, 'basic', 'joint', 0.1)
    assert.deepEqual(r, before)
  })
})

describe('transferToTarget', () => {
  it('이미 target 도달 — no-op', () => {
    const r = makeRatios({ joint: 0.3 })
    const { ratios, finalValue } = transferToTarget(r, 'joint', 0.2, [
      'basic',
    ])
    assert.equal(finalValue, 0.3)
    assert.deepEqual(ratios, r)
  })

  it('단일 donor 충분 — basic 0.4 → joint 0.3 → 0.5', () => {
    const r = makeRatios()
    const { ratios, finalValue } = transferToTarget(r, 'joint', 0.5, [
      'basic',
    ])
    assert.ok(Math.abs(finalValue - 0.5) < 1e-9)
    assert.ok(Math.abs(ratios.basic - 0.2) < 1e-9)
    assert.ok(Math.abs(ratios.joint - 0.5) < 1e-9)
  })

  it('첫 donor 부족 — 다음 donor fallback', () => {
    const r = makeRatios({ basic: 0.05, skin: 0.2 })
    // joint 0.3 → 0.5 (need 0.2). basic 0.05 만 + skin 0.15
    const { ratios, finalValue } = transferToTarget(
      r,
      'joint',
      0.5,
      ['basic', 'skin'],
    )
    assert.ok(Math.abs(finalValue - 0.5) < 1e-9)
    assert.equal(ratios.basic, 0)
    assert.ok(Math.abs(ratios.skin - 0.05) < 1e-9)
  })

  it('모든 donor 부족 — partial 도달', () => {
    const r = makeRatios({ basic: 0.05, weight: 0, skin: 0.05, premium: 0.05 })
    // joint 0.3 → target 0.6 (need 0.3). donors 합 0.15.
    const { finalValue } = transferToTarget(
      r,
      'joint',
      0.6,
      ['basic', 'skin', 'premium'],
    )
    assert.ok(Math.abs(finalValue - 0.45) < 1e-9)
  })

  it('audit #8 — protectedLines 는 donor 제외 (BCS 8 + 관절염)', () => {
    // BCS 8 으로 weight 0.5 보장. 관절염 룰이 joint 0.3 만들려고 함.
    // donors=['weight'] 만 있는데 protected 면 transfer 0.
    const r = makeRatios({ weight: 0.5, joint: 0.1 })
    const { ratios, finalValue } = transferToTarget(
      r,
      'joint',
      0.3,
      ['weight'],
      new Set(['weight']),
    )
    assert.equal(finalValue, 0.1) // 변동 없음
    assert.equal(ratios.weight, 0.5) // 보호됨
  })

  it('audit #24 — donors 에 to 포함 시 self-transfer 차단', () => {
    const r = makeRatios()
    // donors 에 joint (to) 포함 — 자기에서 자기로 transfer X
    const { ratios, finalValue } = transferToTarget(
      r,
      'joint',
      0.5,
      ['joint', 'basic'],
    )
    // 'joint' donor 는 skip, 'basic' 으로만 fallback
    assert.ok(Math.abs(finalValue - 0.5) < 1e-9)
    assert.ok(Math.abs(ratios.basic - 0.2) < 1e-9)
    assert.ok(Math.abs(ratios.joint - 0.5) < 1e-9)
  })

  it('sum 보존 invariant — 모든 transfer 후', () => {
    const r = makeRatios()
    const before = sum(r)
    const { ratios } = transferToTarget(r, 'joint', 0.5, ['basic', 'skin'])
    const after = sum(ratios)
    assert.ok(Math.abs(after - before) < 1e-9)
  })

  it('빈 donors 배열 → no-op', () => {
    const r = makeRatios({ joint: 0.1 })
    const { ratios, finalValue } = transferToTarget(r, 'joint', 0.3, [])
    assert.equal(finalValue, 0.1)
    assert.deepEqual(ratios, r)
  })

  it('target 이 현재 값 이하 — no-op (donor 안 깎임)', () => {
    const r = makeRatios({ joint: 0.5, basic: 0.2 })
    const { ratios, finalValue } = transferToTarget(r, 'joint', 0.3, [
      'basic',
    ])
    assert.equal(finalValue, 0.5)
    assert.equal(ratios.basic, 0.2)
  })
})
