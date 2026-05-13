import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatRange,
  formatSpread,
  merConfidenceInterval,
} from './confidence-interval.ts'

describe('merConfidenceInterval', () => {
  it('accuracyScore 1.0 → 최소 폭 (±5%)', () => {
    const ci = merConfidenceInterval(400, 1)
    assert.equal(ci.spread, 20)
    assert.equal(ci.low, 380)
    assert.equal(ci.high, 420)
  })

  it('accuracyScore 0.7 (default) → 8%', () => {
    const ci = merConfidenceInterval(500, null)
    // base 0.05 + 0.3 * 0.15 = 0.095
    assert.equal(ci.spread, Math.round(500 * 0.095))
  })

  it('accuracyScore 0 → 최대 폭 (±20%)', () => {
    const ci = merConfidenceInterval(400, 0)
    assert.equal(ci.spread, 80)
    assert.equal(ci.low, 320)
    assert.equal(ci.high, 480)
  })

  it('accuracyScore 범위 외 → clamp', () => {
    const high = merConfidenceInterval(400, 1.5)
    assert.equal(high.spread, 20) // 1.0 으로 clamp
    const low = merConfidenceInterval(400, -0.5)
    assert.equal(low.spread, 80) // 0 으로 clamp
  })

  it('low 가 음수 안 됨', () => {
    const ci = merConfidenceInterval(10, 0)
    assert.ok(ci.low >= 0)
  })

  it('formatRange', () => {
    const ci = merConfidenceInterval(400, 1)
    assert.equal(formatRange(ci), '380~420 kcal')
  })

  it('formatSpread', () => {
    const ci = merConfidenceInterval(400, 1)
    assert.equal(formatSpread(ci), '±20 kcal')
  })
})
