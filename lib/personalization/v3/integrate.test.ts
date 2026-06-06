/**
 * 추천 v3 — 라이브 입력 브리지 테스트(게이트 fail-open + 간식 흐름).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { gateBaseSkus, buildV3Recommendation } from './integrate.ts'
import type { AlgorithmInput } from '../types.ts'

function input(overrides: Partial<AlgorithmInput> = {}): AlgorithmInput {
  return {
    dogId: 'd1',
    dogName: '모찌',
    ageMonths: 36,
    weightKg: 8,
    neutered: true,
    activityLevel: 'low',
    bcs: 5,
    allergies: [],
    chronicConditions: [],
    pregnancy: null,
    careGoal: 'weight_management',
    homeCookingExperience: null,
    currentDietSatisfaction: null,
    weightTrend6mo: null,
    giSensitivity: null,
    preferredProteins: [],
    indoorActivity: null,
    dailyWalkMinutes: null,
    pregnancyWeek: null,
    litterSize: null,
    expectedAdultWeightKg: null,
    irisStage: null,
    breed: null,
    dailyKcal: 400,
    dailyGrams: 280,
    ...overrides,
  }
}

describe('gateBaseSkus — 활성 제품 게이트(fail-open)', () => {
  it('전체 활성 → 4종', () => {
    assert.equal(
      gateBaseSkus([
        'chicken-basic',
        'duck-weight',
        'pork-joint',
        'beef-premium',
      ]).length,
      4,
    )
  })
  it('닭만 활성 → 닭 1종', () => {
    const g = gateBaseSkus(['chicken-basic'])
    assert.equal(g.length, 1)
    assert.equal(g[0]!.protein, 'chicken')
  })
  it('빈 배열 → fail-open(4종)', () => {
    assert.equal(gateBaseSkus([]).length, 4)
  })
  it('undefined → fail-open(4종)', () => {
    assert.equal(gateBaseSkus(undefined).length, 4)
  })
  it('매칭 0(전부 비활성) → fail-open(4종, 전원 상담 방지)', () => {
    assert.equal(gateBaseSkus(['no-such-slug']).length, 4)
  })
})

describe('buildV3Recommendation', () => {
  it('체중관리 + 저활동 → 닭 추천 + 엔진 버전', () => {
    const r = buildV3Recommendation(input())
    assert.equal(r.layerA.picks[0]!.protein, 'chicken')
    assert.ok(r.engineVersion.startsWith('v3'))
  })

  it('식욕 picky 주입 → 돼지 쪽으로(기호성)', () => {
    // 유지 목표 + 중립 활동 + picky → 돼지 주(maintain baseline, palatability 1.0).
    // (저활동이면 닭 activity_low 보너스로 근소 역전 — 중립으로 신호 격리.)
    const r = buildV3Recommendation(
      input({ careGoal: 'general_upgrade', bcs: 5, activityLevel: 'medium' }),
      { appetite: 'picky' },
    )
    assert.equal(r.layerA.picks[0]!.protein, 'pork')
  })

  it('게이트로 닭 비활성 → 닭 제외 추천', () => {
    const r = buildV3Recommendation(input(), {
      activeSlugs: ['duck-weight', 'pork-joint', 'beef-premium'],
    })
    assert.ok(!r.layerA.picks.some((p) => p.protein === 'chicken'))
  })

  it('간식 차감(treatReductionPct)이 그램에 반영', () => {
    const base = buildV3Recommendation(input({ treatReductionPct: 0 }))
    const cut = buildV3Recommendation(input({ treatReductionPct: 0.1 }))
    assert.ok(cut.layerA.dailyGrams < base.layerA.dailyGrams)
  })

  it('피부 케어목표 → 레이어 B 대기열', () => {
    const r = buildV3Recommendation(input({ careGoal: 'skin_coat' }))
    assert.deepEqual(r.layerB.waitlistConcerns, ['skin'])
  })
})
