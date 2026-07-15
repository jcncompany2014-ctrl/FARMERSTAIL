/**
 * collapseToSingle — 첫 박스는 무조건 단일 단백질.
 *
 * 사장님 확정 2026-07-15: "웬만하면 단일 단백질로 추천을 하고… 강아지는 초반에
 * 단일 단백질로 먹어야 그게 잘 맞는지, 알레르기가 있는지 없는지 잘 알 수 있다."
 *
 * 핵심 회귀 방지:
 *  1. 결과는 항상 1종 100% (합 = 1).
 *  2. 비율이 가장 높은 라인이 남는다 — 임상 룰의 우선순위를 뒤집지 않는다.
 *  3. **0% 인 라인은 절대 부활하지 않는다** — 알레르기로 차단된 라인이 첫 박스로
 *     올라오면 그게 최악의 사고다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { collapseToSingle } from './boxComposition.ts'
import type { FoodLine, Ratio } from './types.ts'

function ratios(o: Partial<Record<FoodLine, number>>): Record<FoodLine, Ratio> {
  return { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...o } as Record<
    FoodLine,
    Ratio
  >
}
const sum = (r: Record<FoodLine, Ratio>) =>
  Object.values(r).reduce((a, b) => a + b, 0)

describe('collapseToSingle — 항상 1종 100%', () => {
  it('여러 종이 섞여 있어도 1위만 남고 100%', () => {
    const r = collapseToSingle(
      ratios({ skin: 0.2, basic: 0.3, joint: 0.1, weight: 0.1, premium: 0.3 }),
    )
    assert.equal(sum(r), 1)
    assert.equal(Object.values(r).filter((v) => v > 0).length, 1)
  })

  it('이미 단일이면 그대로', () => {
    const r = collapseToSingle(ratios({ weight: 1 }))
    assert.equal(r.weight, 1)
    assert.equal(sum(r), 1)
  })

  it('50:50 이어도 1종만 (앞선 라인이 남음)', () => {
    const r = collapseToSingle(ratios({ basic: 0.5, premium: 0.5 }))
    assert.equal(sum(r), 1)
    assert.equal(Object.values(r).filter((v) => v > 0).length, 1)
  })

  it('가장 비율이 높은 라인이 남는다 (임상 우선순위 보존)', () => {
    const r = collapseToSingle(
      ratios({ basic: 0.2, weight: 0.55, premium: 0.25 }),
    )
    assert.equal(r.weight, 1)
    assert.equal(r.basic, 0)
    assert.equal(r.premium, 0)
  })
})

describe('collapseToSingle — 차단된 라인은 부활하지 않는다', () => {
  it('0% 라인은 절대 선택되지 않는다 (알레르기 차단 보존)', () => {
    // 닭(weight) 알레르기로 0% 처리된 상태.
    const r = collapseToSingle(ratios({ weight: 0, basic: 0.6, premium: 0.4 }))
    assert.equal(r.weight, 0, '차단된 닭이 첫 박스로 올라오면 안 된다')
    assert.equal(r.basic, 1)
  })

  it('단 하나만 살아있으면 그게 100%', () => {
    const r = collapseToSingle(ratios({ weight: 0, basic: 0, joint: 0.3 }))
    assert.equal(r.joint, 1)
    assert.equal(sum(r), 1)
  })

  it('전부 0 이면 빈 채로 (억지로 아무거나 넣지 않는다)', () => {
    const r = collapseToSingle(ratios({}))
    assert.equal(sum(r), 0)
  })
})
