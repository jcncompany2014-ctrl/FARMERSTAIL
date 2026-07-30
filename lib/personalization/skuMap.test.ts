/**
 * skuMap — 가용성 게이트 단위 테스트.
 *
 * 핵심 회귀 방지: 제품 없는 라인/토퍼(연어 보류, 토퍼 미오픈)가 박스에서
 * 조용히 증발(과소급여)하지 않고 가용 라인으로 재분배되는지 검증.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  gateAvailability,
  deriveAvailableLines,
  deriveAvailableToppers,
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
} from './skuMap.ts'
import type { Reasoning, FoodLine } from './types.ts'
import { computeBoxItems } from './boxPricing.ts'

const NO_TOPPER = { protein: 0, vegetable: 0 }

function sum(r: Record<string, number>): number {
  return Object.values(r).reduce((a, b) => a + b, 0)
}

describe('deriveAvailableLines', () => {
  it('활성 slug 집합 → 해당 라인만 (연어 제품 없으면 skin 제외)', () => {
    const lines = deriveAvailableLines([
      'chicken-basic',
      'duck-weight',
      'beef-premium',
      'pork-joint',
    ])
    assert.deepEqual([...lines].sort(), ['basic', 'joint', 'premium', 'weight'])
    assert.ok(!lines.includes('skin'))
  })
  it('빈 집합 → 빈 배열', () => {
    assert.deepEqual(deriveAvailableLines([]), [])
  })
  it('salmon-skin 활성 → skin 합류 (출시 자동 반영)', () => {
    assert.ok(deriveAvailableLines(['salmon-skin']).includes('skin'))
  })
})

describe('deriveAvailableToppers', () => {
  it('farm-protein-mix 활성 → protein axis', () => {
    assert.deepEqual(deriveAvailableToppers(['farm-protein-mix']), ['protein'])
  })
  it('토퍼 제품 없음 → 빈 배열', () => {
    assert.deepEqual(deriveAvailableToppers(['chicken-basic']), [])
  })
})

describe('gateAvailability — 라인 재분배', () => {
  it('availableLines undefined → no-op (하위호환)', () => {
    const r = gateAvailability(
      { basic: 0.3, weight: 0, skin: 0.7, premium: 0, joint: 0 },
      NO_TOPPER,
      {},
    )
    assert.equal(r.lineRatios.skin, 0.7)
  })

  it('skin(연어) 불가 → basic(오리)로 이동, 합 1.0 유지', () => {
    // v2.0 ③-A: 오리 = basic 키 (omega3 최다). skin fallback = basic.
    const r = gateAvailability(
      { basic: 0.3, weight: 0, skin: 0.7, premium: 0, joint: 0 },
      NO_TOPPER,
      { availableLines: ['basic', 'weight', 'premium', 'joint'] },
    )
    assert.equal(r.lineRatios.skin, 0)
    assert.equal(r.lineRatios.basic, 1.0)
    assert.ok(Math.abs(sum(r.lineRatios) - 1.0) < 1e-9)
  })

  it('skin·weight 둘 다 불가 → basic 으로 폴백', () => {
    const r = gateAvailability(
      { basic: 0.3, weight: 0, skin: 0.7, premium: 0, joint: 0 },
      NO_TOPPER,
      { availableLines: ['basic', 'premium', 'joint'] },
    )
    assert.equal(r.lineRatios.skin, 0)
    assert.equal(r.lineRatios.basic, 1.0)
  })

  it('재분배 사유 chip push (gate-line-skin)', () => {
    const reasoning: Reasoning[] = []
    gateAvailability(
      { basic: 0.3, weight: 0, skin: 0.7, premium: 0, joint: 0 },
      NO_TOPPER,
      { availableLines: ['basic', 'weight', 'premium', 'joint'], reasoning },
    )
    assert.ok(reasoning.some((x) => x.ruleId === 'gate-line-skin'))
  })

  it('가용 라인만 있으면 변경 없음', () => {
    const inp = { basic: 0.5, weight: 0.5, skin: 0, premium: 0, joint: 0 }
    const r = gateAvailability(inp, NO_TOPPER, {
      availableLines: ['basic', 'weight'],
    })
    assert.deepEqual(r.lineRatios, inp)
  })
})

describe('gateAvailability — 토퍼', () => {
  const MAIN = { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 }
  it('vegetable 토퍼 불가 → 0 (메인이 100% kcal)', () => {
    const r = gateAvailability(MAIN, { protein: 0.1, vegetable: 0.1 }, {
      availableToppers: ['protein'],
    })
    assert.equal(r.toppers.vegetable, 0)
    assert.equal(r.toppers.protein, 0.1)
  })
  it('availableToppers undefined → no-op', () => {
    const r = gateAvailability(MAIN, { protein: 0.1, vegetable: 0.1 }, {})
    assert.equal(r.toppers.vegetable, 0.1)
  })
})

describe('skuMap 상수 — 출시 contract', () => {
  it('skin → salmon-skin (연어 출시 시 이 slug 로 자동 합류)', () => {
    assert.equal(LINE_TO_SLUG.skin, 'salmon-skin')
  })
  it('protein 토퍼 → farm-protein-mix (현재 활성)', () => {
    assert.equal(TOPPER_TO_SLUG.protein, 'farm-protein-mix')
  })
})

describe('부분 레코드 방어 (DB JSON 캐스팅 경로)', () => {
  it('★ 라인 키가 빠진 처방이 들어와도 살아있는 비율이 NaN 이 되지 않는다', () => {
  // 타입은 5개 라인 전부를 요구하지만 실제 입력은 `dog_formulas.formula` 를
  // **캐스팅해서** 들어온다(DB JSON 은 타입 검사를 안 받는다). 예전엔 키가
  // 빠지면 `lines[target] += undefined` 로 **정상 라인까지 NaN** 이 됐고,
  // 그러면 박스에서 그 단백질이 조용히 사라져 과소급여가 된다 — 이 파일이
  // 막으려고 만들어진 바로 그 사고다.
  const partial = { premium: 1 } as unknown as Record<FoodLine, number>
  const g = gateAvailability(partial, { protein: 0, vegetable: 0 }, {
    availableLines: ['premium'],
    availableToppers: [],
  })
  for (const [line, v] of Object.entries(g.lineRatios)) {
    assert.ok(Number.isFinite(v), `${line} 이 숫자가 아니다: ${v}`)
  }
  assert.equal(g.lineRatios.premium, 1, '살아있는 라인의 비율은 그대로여야 한다')
})

  it('부분 레코드로도 실제 박스가 만들어진다 (라인이 증발하지 않는다)', () => {
  const slug = LINE_TO_SLUG.premium!
  const products = {
    [slug]: {
      slug,
      price: 1000,
      sale_price: 850,
      stock: 100,
      is_subscribable: true,
      nutrition_facts: null,
    },
  }
  const items = computeBoxItems({
    formula: {
      lineRatios: { premium: 1 } as unknown as Record<FoodLine, number>,
      toppers: { protein: 0, vegetable: 0 },
      dailyKcal: 500,
    },
    freshRatio: 100,
    products,
  })
  assert.equal(items.length, 1, '프리미엄 라인이 박스에 남아야 한다')
  assert.ok(Number.isFinite(items[0]!.mealG), 'mealG 가 NaN 이면 안 된다')
  assert.ok(items[0]!.mealG > 0, `mealG = ${items[0]!.mealG}`)
})
})
