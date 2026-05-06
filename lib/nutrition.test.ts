/**
 * calculateNutrition — MER / factor / macro 계산 단위 테스트.
 *
 * 2026-05-05 audit fix 대상:
 *   1. bcsMerFactor 1.4 → 1.20 (BCS ≤2)
 *   2. pregnancy/lactation gender 게이트
 *   3. NRC 2006 임신/수유 정확 수식 (week / litter)
 *   4. feed_g = MER / 2.0
 *   5. lifeStage size-aware (소형 9세, 중형 7세, 대형 6세)
 *   6. macro 합 100% 보존
 *   7. weight 0/음수 가드
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateNutrition, type DogInfo, type SurveyAnswers } from './nutrition.ts'

function baseDog(overrides: Partial<DogInfo> = {}): DogInfo {
  return {
    weight: 10,
    ageValue: 5,
    ageUnit: 'years',
    neutered: false,
    activityLevel: 'medium',
    gender: 'female',
    ...overrides,
  }
}

function baseAnswers(overrides: Partial<SurveyAnswers> = {}): SurveyAnswers {
  return {
    bodyCondition: 'ideal',
    allergies: [],
    healthConcerns: [],
    bcsExact: 5,
    ...overrides,
  }
}

describe('calculateNutrition — MER 기본 케이스', () => {
  it('10kg 성견 BCS 5 medium 활동 = RER 393 × 1.6 ≈ 629 kcal', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    assert.equal(r.rer, 394)
    // RER 393.64 × 1.6 = 629.82 → Math.round = 630
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.6))
    assert.equal(r.factor, 1.6)
  })

  it('10kg 시니어 (8세) BCS 5 = RER × 1.2', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers(),
    )
    assert.equal(r.rer, 394)
    // 시니어 base 1.2 × bcs 5 (1.0) = 1.2
    assert.equal(r.factor, 1.2)
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.2))
  })
})

describe('calculateNutrition — bcsMerFactor (audit fix)', () => {
  it('BCS 2 (저체중) — 시니어 base × 1.20 = 1.44 (audit: 1.4 → 1.20)', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers({ bcsExact: 2 }),
    )
    assert.equal(r.factor, 1.44)
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.44))
  })

  it('BCS 9 (비만) — 감량 protocol RER × 0.9 (시니어 1.2 × 0.75)', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers({ bcsExact: 9 }),
    )
    assert.equal(r.factor, 0.9)
  })
})

describe('calculateNutrition — pregnancy/lactation gender 게이트', () => {
  it('수컷에 lactating 입력 — 무시 (factor 폭주 차단)', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'male' }),
      baseAnswers({ pregnancyStatus: 'lactating' }),
    )
    // 수컷은 lactating 무시 → 기본 1.6 만 적용
    assert.equal(r.factor, 1.6)
    assert.ok(!r.riskFlags.includes('LACTATING'))
  })

  it('중성화 암컷에 pregnant — 무시', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'female', neutered: true }),
      baseAnswers({ pregnancyStatus: 'pregnant' }),
    )
    // 중성화 0.9 만 적용
    assert.equal(r.factor, 1.44)
    assert.ok(!r.riskFlags.includes('PREGNANT'))
  })

  it('암컷 비중성화 lactating — 적용 (REPLACE activity base)', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'female', neutered: false }),
      baseAnswers({ pregnancyStatus: 'lactating' }),
    )
    // v1.6.1 fix: lactating REPLACES activity base (not stack).
    // default 2.5 (litter 미입력, ≈3 pups) × BCS 5 (1.0) = 2.5
    assert.equal(r.factor, 2.5)
    assert.ok(r.riskFlags.includes('LACTATING'))
  })
})

describe('calculateNutrition — NRC 2006 임신/수유 정확 수식 (REPLACE activity)', () => {
  it('임신 1주차 — RER × 1.3 (REPLACE)', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ pregnancyStatus: 'pregnant', pregnancyWeek: 1 }),
    )
    // factor = 1.3 (NRC) × BCS 5 (1.0) = 1.3 (activity base 1.6 무시)
    assert.equal(r.factor, 1.3)
  })

  it('임신 7주차 — RER × 1.8 (후기, REPLACE)', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ pregnancyStatus: 'pregnant', pregnancyWeek: 7 }),
    )
    assert.equal(r.factor, 1.8)
  })

  it('수유 4마리 — RER × 4.3 (REPLACE, NRC 정확)', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ pregnancyStatus: 'lactating', litterSize: 4 }),
    )
    // 1.5 + 0.7 × 4 = 4.3, BCS 5 (1.0) → factor 4.3
    assert.equal(r.factor, 4.3)
  })

  it('수유 1마리 — RER × 2.2 (REPLACE)', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ pregnancyStatus: 'lactating', litterSize: 1 }),
    )
    assert.equal(r.factor, 2.2)
  })

  it('수유 10마리 — cap 5.0', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ pregnancyStatus: 'lactating', litterSize: 10 }),
    )
    // 1.5 + 0.7 × 8 = 7.1 → cap 5.0 (NRC max)
    assert.equal(r.factor, 5)
  })

  it('수유 4마리 + BCS 2 (저체중 mom) — 4.3 × 1.20 = 5.16 → cap 5.0', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({
        pregnancyStatus: 'lactating',
        litterSize: 4,
        bcsExact: 2,
      }),
    )
    // 4.3 × 1.20 = 5.16 → cap 5.0
    assert.equal(r.factor, 5)
    assert.ok(r.riskFlags.includes('FACTOR_CAPPED_HIGH'))
  })
})

describe('calculateNutrition — feed_g = MER / 2.0', () => {
  it('feedG = MER / 2.0', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers(),
    )
    assert.equal(r.feedG, Math.round(r.mer / 2.0))
  })

  it('성견 medium 활동 — feedG = MER / 2.0', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    assert.equal(r.feedG, Math.round(r.mer / 2.0))
  })
})

describe('calculateNutrition — lifeStage size-aware', () => {
  it('소형 (5kg) 7세 → adult (소형은 9세부터 senior)', () => {
    const r = calculateNutrition(
      baseDog({ weight: 5, ageValue: 7 }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'adult')
  })

  it('소형 (5kg) 9세 → senior', () => {
    const r = calculateNutrition(
      baseDog({ weight: 5, ageValue: 9 }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'senior')
  })

  it('중형 (15kg) 7세 → senior', () => {
    const r = calculateNutrition(
      baseDog({ weight: 15, ageValue: 7 }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'senior')
  })

  it('대형 (30kg) 6세 → senior', () => {
    const r = calculateNutrition(
      baseDog({ weight: 30, ageValue: 6 }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'senior')
  })

  it('대형 (30kg) 5세 → adult', () => {
    const r = calculateNutrition(
      baseDog({ weight: 30, ageValue: 5 }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'adult')
  })
})

describe('calculateNutrition — macro 합 100%', () => {
  it('일반 성견 — protein + fat + carb + fiber = 100', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    const sum = r.protein.pct + r.fat.pct + r.carb.pct + r.fiber.pct
    assert.equal(sum, 100)
  })

  it('극단 chronic combo — 합 100 보존', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({
        chronicConditions: [
          'arthritis', // protein +2
          'cushings', // protein +2
          'diabetes', // protein +5
          'epi', // protein +3
        ],
        mcsScore: 4, // protein +6
      }),
    )
    const sum = r.protein.pct + r.fat.pct + r.carb.pct + r.fiber.pct
    assert.equal(sum, 100, '극단 조합에서도 합 100')
    // protein 클램프 50% 이내
    assert.ok(r.protein.pct <= 50)
  })
})

describe('calculateNutrition — weight 가드', () => {
  it('weight 0 — 0.5kg 최소로 clamp', () => {
    const r = calculateNutrition(
      baseDog({ weight: 0 }),
      baseAnswers(),
    )
    // RER = 70 × 0.5^0.75 ≈ 41.6
    assert.ok(r.rer > 40 && r.rer < 50)
    assert.ok(r.mer > 0)
  })

  it('weight 음수 — 0.5kg 으로 clamp', () => {
    const r = calculateNutrition(
      baseDog({ weight: -5 }),
      baseAnswers(),
    )
    assert.ok(r.rer > 40 && r.rer < 50)
  })

  it('weight 200kg — 100kg 으로 clamp', () => {
    const r = calculateNutrition(
      baseDog({ weight: 200, ageValue: 3 }),
      baseAnswers(),
    )
    // RER = 70 × 100^0.75 ≈ 2214
    assert.ok(r.rer > 2000 && r.rer < 2500)
  })
})
