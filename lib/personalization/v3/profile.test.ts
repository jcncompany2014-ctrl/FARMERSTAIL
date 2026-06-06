/**
 * 추천 v3 — AlgorithmInput → NeedProfile 매퍼 테스트.
 * 근거 매핑(weightGoal/senior/concerns/appetite)이 의도대로 흐르는지 박제.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toNeedProfile } from './profile.ts'
import { recommend } from './engine.ts'
import type { AlgorithmInput } from '../types.ts'

function input(overrides: Partial<AlgorithmInput> = {}): AlgorithmInput {
  return {
    dogId: 'd1',
    dogName: '모찌',
    ageMonths: 36,
    weightKg: 8,
    neutered: true,
    activityLevel: 'medium',
    bcs: 5,
    allergies: [],
    chronicConditions: [],
    pregnancy: null,
    careGoal: 'general_upgrade',
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

describe('toNeedProfile — weightGoal', () => {
  it('케어목표 체중관리 → loss', () => {
    assert.equal(
      toNeedProfile(input({ careGoal: 'weight_management' })).weightGoal,
      'loss',
    )
  })
  it('BCS 7 → loss / BCS 2 → gain / BCS 5 → maintain', () => {
    assert.equal(toNeedProfile(input({ bcs: 7 })).weightGoal, 'loss')
    assert.equal(toNeedProfile(input({ bcs: 2 })).weightGoal, 'gain')
    assert.equal(toNeedProfile(input({ bcs: 5 })).weightGoal, 'maintain')
  })
  it('당뇨 → loss (BCS 무관)', () => {
    assert.equal(
      toNeedProfile(input({ bcs: 5, chronicConditions: ['diabetes'] }))
        .weightGoal,
      'loss',
    )
  })
})

describe('toNeedProfile — senior (size-aware)', () => {
  it('소형(5kg): 110개월 시니어, 100개월 아님', () => {
    assert.equal(toNeedProfile(input({ weightKg: 5, ageMonths: 110 })).senior, true)
    assert.equal(toNeedProfile(input({ weightKg: 5, ageMonths: 100 })).senior, false)
  })
  it('대형(30kg): 73개월 시니어, 70개월 아님', () => {
    assert.equal(toNeedProfile(input({ weightKg: 30, ageMonths: 73 })).senior, true)
    assert.equal(toNeedProfile(input({ weightKg: 30, ageMonths: 70 })).senior, false)
  })
})

describe('toNeedProfile — appetite', () => {
  it('picky→picky / reduced→low / strong→normal / 미입력→normal', () => {
    assert.equal(toNeedProfile(input(), { appetite: 'picky' }).appetite, 'picky')
    assert.equal(toNeedProfile(input(), { appetite: 'reduced' }).appetite, 'low')
    assert.equal(toNeedProfile(input(), { appetite: 'strong' }).appetite, 'normal')
    assert.equal(toNeedProfile(input()).appetite, 'normal')
  })
})

describe('toNeedProfile — functionalConcerns', () => {
  it('케어목표 피부 → skin / 관절 → joint', () => {
    assert.deepEqual(
      toNeedProfile(input({ careGoal: 'skin_coat' })).functionalConcerns,
      ['skin'],
    )
    assert.deepEqual(
      toNeedProfile(input({ careGoal: 'joint_senior' })).functionalConcerns,
      ['joint'],
    )
  })
  it('만성질환 매핑: 관절염→joint, 피부염→skin, IBD→digestion', () => {
    assert.ok(
      toNeedProfile(input({ chronicConditions: ['arthritis'] }))
        .functionalConcerns.includes('joint'),
    )
    assert.ok(
      toNeedProfile(input({ chronicConditions: ['allergy_skin'] }))
        .functionalConcerns.includes('skin'),
    )
    assert.ok(
      toNeedProfile(input({ chronicConditions: ['ibd'] }))
        .functionalConcerns.includes('digestion'),
    )
  })
  it('GI 민감 frequent/always → digestion', () => {
    assert.ok(
      toNeedProfile(input({ giSensitivity: 'always' }))
        .functionalConcerns.includes('digestion'),
    )
  })
  it('immune 은 설문 신호 부재 → 절대 매핑 안 함', () => {
    const p = toNeedProfile(
      input({
        careGoal: 'joint_senior',
        chronicConditions: ['arthritis', 'allergy_skin', 'ibd'],
        giSensitivity: 'always',
      }),
    )
    assert.ok(!p.functionalConcerns.includes('immune'))
  })
})

describe('toNeedProfile — passthrough', () => {
  it('알레르기·활동량 그대로', () => {
    const p = toNeedProfile(
      input({ allergies: ['소고기'], activityLevel: 'high' }),
    )
    assert.deepEqual(p.allergies, ['소고기'])
    assert.equal(p.activityLevel, 'high')
  })
})

describe('통합 — toNeedProfile → recommend', () => {
  it('체중관리 + 저활동 → 닭 추천', () => {
    const p = toNeedProfile(
      input({ careGoal: 'weight_management', activityLevel: 'low' }),
    )
    const r = recommend(p, 400)
    assert.equal(r.layerA.picks[0]!.protein, 'chicken')
  })
  it('피부 케어목표 → 레이어 B 피부 소스 대기열', () => {
    const p = toNeedProfile(input({ careGoal: 'skin_coat' }))
    const r = recommend(p, 400)
    assert.deepEqual(r.layerB.waitlistConcerns, ['skin'])
  })
})
