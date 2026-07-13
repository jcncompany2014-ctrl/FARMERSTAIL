/**
 * snapBoxLines / snapBoxRatios — 박스 SKU ≤2종 스냅 규칙 단위 테스트.
 *
 * 규칙(사장님 2026-07-13): 박스는 최대 2종. 1종이면 100%, 2종이면 50:50.
 * 상위 2종 취하되 2번째가 SECOND_LINE_MIN(20%) 미만이면 최상위 1종 100%.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { snapBoxLines, snapBoxRatios } from './boxComposition.ts'
import type { FoodLine, Ratio } from './types.ts'

function ratios(partial: Partial<Record<FoodLine, Ratio>>): Record<FoodLine, Ratio> {
  return { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...partial }
}

describe('snapBoxLines', () => {
  it('단일 라인 → 1종 100%', () => {
    const out = snapBoxLines(ratios({ weight: 1 }))
    assert.deepEqual(out, [{ line: 'weight', ratio: 1 }])
  })

  it('두 라인 모두 유의미 → 상위 2종 50:50', () => {
    const out = snapBoxLines(ratios({ basic: 0.6, skin: 0.4 }))
    assert.equal(out.length, 2)
    assert.equal(out[0]?.ratio, 0.5)
    assert.equal(out[1]?.ratio, 0.5)
    assert.deepEqual(
      out.map((x) => x.line).sort(),
      ['basic', 'skin'],
    )
  })

  it('3종+ → 상위 2종만 50:50 (나머지 버림)', () => {
    // 오리(basic)50 · 연어(skin)20 · 돼지(joint)30 → basic + joint 50:50
    const out = snapBoxLines(ratios({ basic: 0.5, skin: 0.2, joint: 0.3 }))
    assert.equal(out.length, 2)
    assert.deepEqual(
      out.map((x) => x.line).sort(),
      ['basic', 'joint'],
    )
    assert.ok(out.every((x) => x.ratio === 0.5))
  })

  it('2번째가 20% 미만 → 최상위 1종 100%', () => {
    // 닭(weight)90 · 소(premium)10 → weight 100%
    const out = snapBoxLines(ratios({ weight: 0.9, premium: 0.1 }))
    assert.deepEqual(out, [{ line: 'weight', ratio: 1 }])
  })

  it('경계 — 2번째 정확히 20% → 2종 50:50', () => {
    const out = snapBoxLines(ratios({ basic: 0.8, skin: 0.2 }))
    assert.equal(out.length, 2)
  })

  it('빈 입력 → 빈 박스', () => {
    assert.deepEqual(snapBoxLines(ratios({})), [])
  })

  it('항상 SKU ≤ 2', () => {
    const out = snapBoxLines(
      ratios({ basic: 0.2, weight: 0.2, skin: 0.2, premium: 0.2, joint: 0.2 }),
    )
    assert.ok(out.length <= 2)
  })
})

describe('snapBoxRatios', () => {
  it('Record 형태로 합 1.0, 나머지 0', () => {
    const r = snapBoxRatios(ratios({ basic: 0.5, skin: 0.3, joint: 0.2 }))
    const sum = (Object.values(r) as number[]).reduce((s, v) => s + v, 0)
    assert.equal(sum, 1)
    // 상위 2종(basic, skin) 만 0.5, 나머지 0
    assert.equal(r.basic, 0.5)
    assert.equal(r.skin, 0.5)
    assert.equal(r.joint, 0)
    assert.equal(r.weight, 0)
    assert.equal(r.premium, 0)
  })
})
