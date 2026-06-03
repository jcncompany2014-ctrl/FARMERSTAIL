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
import type { Reasoning } from './types.ts'

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
