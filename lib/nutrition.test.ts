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
import {
  calculateNutrition,
  treatCalorieFraction,
  safetyWeightShift,
  AVG_ENERGY_DENSITY_KCAL_PER_G,
  type DogInfo,
  type SurveyAnswers,
} from './nutrition.ts'

describe('safetyWeightShift — 신뢰도 기반 비대칭 안전 체중 보정 (발명 모듈 D)', () => {
  it('신뢰도 미입력/null → 무변경 (하위호환)', () => {
    assert.equal(
      safetyWeightShift(10, undefined, {
        bcsScore: 8,
        careGoal: 'weight_management',
        stage: 'adult',
      }),
      10,
    )
    assert.equal(safetyWeightShift(10, null, { bcsScore: 8, stage: 'adult' }), 10)
  })

  it('신뢰도 1.0 (동물병원) → 무변경 (불확실성 0)', () => {
    assert.equal(safetyWeightShift(10, 1.0, { bcsScore: 8, stage: 'adult' }), 10)
  })

  it('비만(BCS 8) + 신뢰도 0.4 → 체중 하향 (덜 급여, 4.8%)', () => {
    const w = safetyWeightShift(10, 0.4, { bcsScore: 8, stage: 'adult' })
    assert.ok(Math.abs(w - 9.52) < 1e-9) // 10 × (1 − 0.08×0.6)
  })

  it('저체중(BCS 2) + 신뢰도 0.4 → 체중 상향 (더 급여)', () => {
    const w = safetyWeightShift(10, 0.4, { bcsScore: 2, stage: 'adult' })
    assert.ok(Math.abs(w - 10.48) < 1e-9) // 10 × (1 + 0.08×0.6)
  })

  it('체중관리 목표(BCS 정상) + 신뢰도 0 → 최대 8% 하향', () => {
    const w = safetyWeightShift(10, 0, {
      bcsScore: 5,
      careGoal: 'weight_management',
      stage: 'adult',
    })
    assert.ok(Math.abs(w - 9.2) < 1e-9) // 10 × (1 − 0.08×1)
  })

  it('자견 + 낮은 신뢰도 → 상향 (성장기 저급 방지)', () => {
    const w = safetyWeightShift(5, 0.5, { bcsScore: 5, stage: 'puppy' })
    assert.ok(w > 5)
  })

  it('대칭(BCS 5 일반유지) → 무변경 (데이터 부실로 굶기지 않음)', () => {
    assert.equal(
      safetyWeightShift(10, 0.3, { bcsScore: 5, stage: 'adult' }),
      10,
    )
  })
})

describe('calculateNutrition — 산책분 → MER 블렌드 (②)', () => {
  const baseDog: DogInfo = {
    weight: 5,
    ageValue: 3,
    ageUnit: 'years',
    neutered: false,
    activityLevel: 'low',
    gender: null,
  }
  const baseAns: SurveyAnswers = {
    bodyCondition: 'ideal',
    allergies: [],
    healthConcerns: [],
  }

  it('산책분 미입력 → 프로필 activityLevel 그대로 (하위호환)', () => {
    const noWalk = calculateNutrition(baseDog, baseAns).mer
    const withWalk = calculateNutrition(baseDog, {
      ...baseAns,
      dailyWalkMinutes: 150,
    }).mer
    assert.ok(withWalk > noWalk, '산책 많으면 MER ↑ (granular 반영)')
  })

  it('high 프로필 + 산책 10분 → MER 하향하되 과도하지 않게', () => {
    const highDog: DogInfo = { ...baseDog, activityLevel: 'high' }
    const high = calculateNutrition(highDog, baseAns).mer
    const highLowWalk = calculateNutrition(highDog, {
      ...baseAns,
      dailyWalkMinutes: 10,
    }).mer
    assert.ok(highLowWalk < high, '산책 적으면 ↓')
    assert.ok(highLowWalk > high * 0.8, '드라마틱하게 깎이지 않음 (앵커 70%)')
  })

  it('실내활동 active → 소폭 가산', () => {
    const calm = calculateNutrition(baseDog, {
      ...baseAns,
      dailyWalkMinutes: 60,
      indoorActivity: 'calm',
    }).mer
    const active = calculateNutrition(baseDog, {
      ...baseAns,
      dailyWalkMinutes: 60,
      indoorActivity: 'active',
    }).mer
    assert.ok(active > calm)
  })
})

describe('treatCalorieFraction — 간식 칼로리 비중 (AAFCO/WSAVA 10% 룰)', () => {
  it('매일 → 0.10 (룰 상한)', () => {
    assert.equal(treatCalorieFraction('매일'), 0.1)
  })
  it('가끔 → 0.05', () => {
    assert.equal(treatCalorieFraction('가끔'), 0.05)
  })
  it('거의 안 줌 → 0', () => {
    assert.equal(treatCalorieFraction('거의 안 줌'), 0)
  })
  it('미입력/null/빈문자 → 0 (하위호환 — 무변경)', () => {
    assert.equal(treatCalorieFraction(undefined), 0)
    assert.equal(treatCalorieFraction(null), 0)
    assert.equal(treatCalorieFraction(''), 0)
  })
})

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
  it('10kg 성견 BCS 5 medium 활동 = RER 393 × 1.57 (FEDIAF 110) ≈ 618 kcal', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    assert.equal(r.rer, 394)
    // Tier S F2-1: medium factor 1.6 → 1.57 (FEDIAF 2024 Annex 7.2 110×BW^0.75)
    // RER 393.64 × 1.57 = 618.01 → Math.round = 618
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.57))
    assert.equal(r.factor, 1.57)
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
    // 수컷은 lactating 무시 → 기본 1.57 (FEDIAF medium) 만 적용
    assert.equal(r.factor, 1.57)
    assert.ok(!r.riskFlags.includes('LACTATING'))
  })

  it('중성화 암컷에 pregnant — 무시', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'female', neutered: true }),
      baseAnswers({ pregnancyStatus: 'pregnant' }),
    )
    // 중성화 0.9 만 적용. 1.57 × 0.9 = 1.413 (Tier S F2-1: medium 1.6 → 1.57)
    assert.equal(r.factor, 1.41)
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
    // factor = 1.3 (NRC) × BCS 5 (1.0) = 1.3 (activity base 1.57 무시)
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

// audit 3-15: feedG 분모를 AVG_ENERGY_DENSITY_KCAL_PER_G (1.45 — 레시피 v2.1
// 라인 평균) 상수로 분리. 테스트도 SSOT 상수 import 해서 자동 동기화.
describe('calculateNutrition — feed_g = MER / AVG_ENERGY_DENSITY_KCAL_PER_G', () => {
  it('feedG = round(MER / density)', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers(),
    )
    assert.equal(
      r.feedG,
      Math.round(r.mer / AVG_ENERGY_DENSITY_KCAL_PER_G),
    )
  })

  it('성견 medium 활동 — feedG = round(MER / density)', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    assert.equal(
      r.feedG,
      Math.round(r.mer / AVG_ENERGY_DENSITY_KCAL_PER_G),
    )
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
    // A3 tier 후: toy 보정 적용. RER = 70 × 2.5^0.75 - 70 × 2^0.75 + 35 ≈ 56.5
    assert.ok(r.rer > 50 && r.rer < 70, `rer=${r.rer}`)
    assert.ok(r.mer > 0)
  })

  it('weight 음수 — 0.5kg 으로 clamp', () => {
    const r = calculateNutrition(
      baseDog({ weight: -5 }),
      baseAnswers(),
    )
    // A3 tier 후: toy 보정 적용 (위와 동일)
    assert.ok(r.rer > 50 && r.rer < 70)
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
