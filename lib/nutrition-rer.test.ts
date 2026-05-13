import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeRer } from './nutrition.ts'

describe('computeRer (A3 tier 분기)', () => {
  it('mid range 5kg → 표준 NRC 공식', () => {
    const r = computeRer(5)
    assert.ok(Math.abs(r - 70 * Math.pow(5, 0.75)) < 0.5)
  })

  it('mid range 30kg → 표준 NRC 공식', () => {
    const r = computeRer(30)
    assert.ok(Math.abs(r - 70 * Math.pow(30, 0.75)) < 0.5)
  })

  it('toy 1kg → 보정 (이전 70 → 새 > 70)', () => {
    const r = computeRer(1)
    assert.ok(r > 70, `toy 보정: ${r}`)
  })

  it('toy 0.5kg → 안정', () => {
    const r = computeRer(0.5)
    assert.ok(r > 0 && r < 100)
  })

  it('giant 70kg → 0.73 거듭제곱', () => {
    const r = computeRer(70)
    const standard = 70 * Math.pow(70, 0.75)
    assert.ok(r < standard, `giant 보정 = ${r} < standard = ${standard}`)
  })

  it('monotonic — 체중 증가 시 RER 증가', () => {
    for (let w = 1; w < 90; w += 5) {
      const a = computeRer(w)
      const b = computeRer(w + 1)
      assert.ok(b > a, `w=${w}: a=${a} b=${b}`)
    }
  })

  it('boundary 2kg / 50kg 연속성', () => {
    const just_under_2 = computeRer(1.99)
    const just_over_2 = computeRer(2.01)
    assert.ok(
      Math.abs(just_under_2 - just_over_2) < 20,
      `boundary 2kg: ${just_under_2} vs ${just_over_2}`,
    )
    const just_under_50 = computeRer(49.9)
    const just_over_50 = computeRer(50.1)
    assert.ok(
      Math.abs(just_under_50 - just_over_50) < 50,
      `boundary 50kg: ${just_under_50} vs ${just_over_50}`,
    )
  })
})
