import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, quantize, quantizeAndNormalize } from './quantize.ts'
import type { FoodLine, Ratio } from './types.ts'

const EMPTY: Record<FoodLine, Ratio> = {
  basic: 0,
  weight: 0,
  skin: 0,
  premium: 0,
  joint: 0,
}

describe('normalize', () => {
  it('합 1.0 으로 정규화', () => {
    const r = normalize({ ...EMPTY, basic: 2, premium: 3 }, new Set())
    const sum = Object.values(r).reduce((s, v) => s + v, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9)
  })

  it('blocked 라인은 0', () => {
    const r = normalize(
      { ...EMPTY, basic: 0.5, premium: 0.5 },
      new Set(['premium']),
    )
    assert.equal(r.premium, 0)
    assert.equal(r.basic, 1)
  })

  it('모두 blocked → fallback 라인 100% (사용자 0 사료 차단)', () => {
    const r = normalize(
      { ...EMPTY, basic: 0.5 },
      new Set(['basic', 'weight', 'skin', 'premium', 'joint']),
    )
    // 모두 blocked 면 fallback 라인 100% 강제 (사용자에게 0 사료 X).
    const sum = Object.values(r).reduce((s, v) => s + v, 0)
    assert.equal(sum, 1)
  })
})

describe('quantize', () => {
  it('0.1 단위로 round', () => {
    const r = quantize({ ...EMPTY, basic: 0.37, premium: 0.63 })
    for (const v of Object.values(r)) {
      const rem = Math.abs((v * 10) % 1)
      assert.ok(rem < 1e-6, `${v} not multiple of 0.1`)
    }
  })

  it('합 1.0 보존', () => {
    const r = quantize({ ...EMPTY, basic: 0.33, premium: 0.33, joint: 0.34 })
    const sum = Object.values(r).reduce((s, v) => s + v, 0)
    assert.ok(Math.abs(sum - 1) < 1e-6)
  })
})

describe('quantizeAndNormalize', () => {
  it('blocked + 정규화 + quantize 한 번에', () => {
    const r = quantizeAndNormalize(
      { ...EMPTY, basic: 0.5, premium: 0.3, weight: 0.2 },
      new Set(['weight']),
    )
    assert.equal(r.weight, 0)
    const sum = Object.values(r).reduce((s, v) => s + v, 0)
    assert.ok(Math.abs(sum - 1) < 1e-6)
  })

  it('모두 0 → fallback 라인 100%', () => {
    const r = quantizeAndNormalize(EMPTY, new Set(['basic', 'weight', 'skin']))
    // premium / joint 중 하나가 100%
    const nonZero = Object.values(r).filter((v) => v > 0)
    assert.equal(nonZero.length, 1)
    assert.equal(nonZero[0], 1)
  })
})
