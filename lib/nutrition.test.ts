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
  needsCalorieVetRoute,
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

describe('calculateNutrition — v2 사다리: 활동 신호 처리', () => {
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

  it('산책 시간은 가산하지 않는다 (v2 원칙: duration 은 나쁜 예측변수)', () => {
    const noWalk = calculateNutrition(baseDog, baseAns)
    const withWalk = calculateNutrition(baseDog, {
      ...baseAns,
      dailyWalkMinutes: 150,
    })
    // low + 미중성화 = 1.4 + 0.2 = 1.6 — 산책 150분이어도 동일.
    assert.equal(noWalk.factor, 1.6)
    assert.equal(withWalk.factor, 1.6)
  })

  it('low 프로필 + 산책 <30분 → 초비활동 −0.1 (v2 감산 프록시)', () => {
    const inactive = calculateNutrition(baseDog, {
      ...baseAns,
      dailyWalkMinutes: 10,
    })
    assert.equal(inactive.factor, 1.5) // 1.4 + 0.2(미중성화) − 0.1(초비활동)
  })

  it('high 자가보고 → +0.1 만 (증거 게이트 — 객관 증거는 2단계)', () => {
    const highDog: DogInfo = { ...baseDog, activityLevel: 'high' }
    const high = calculateNutrition(highDog, baseAns)
    assert.equal(high.factor, 1.7) // 1.4 + 0.2(미중성화) + 0.1(활발 자가보고)
  })

  it('실내활동 필드는 계수에 영향 없음 (v2 — nudge 폐기)', () => {
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
    assert.equal(active, calm)
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

describe('calculateNutrition — v2 사다리 기본 케이스', () => {
  it('10kg 성견(5세) 미중성화 BCS5 = 1.4 + 0.2(미중성화) = 1.6 → 630 kcal', () => {
    const r = calculateNutrition(baseDog(), baseAnswers())
    assert.equal(r.rer, 394)
    assert.equal(r.factor, 1.6)
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.6))
    // 사다리 근거 노출(투명성) — 기본 + 미중성화 2줄.
    assert.equal(r.factorBreakdown.length, 2)
  })

  it('10kg 8세 BCS5 = 1.4 + 0.2(미중성화) − 0.1(중년 7~9세) = 1.5', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers(),
    )
    assert.equal(r.rer, 394)
    assert.equal(r.factor, 1.5)
    assert.equal(r.mer, Math.round(70 * Math.pow(10, 0.75) * 1.5))
  })

  it('10kg 12세 = 노령 −0.2 → 1.4 (중성화면 1.4 − 0.2 + 0 = 1.2)', () => {
    const intact = calculateNutrition(baseDog({ ageValue: 12 }), baseAnswers())
    assert.equal(intact.factor, 1.4) // 1.4 + 0.2 − 0.2
    const neutered = calculateNutrition(
      baseDog({ ageValue: 12, neutered: true }),
      baseAnswers(),
    )
    assert.equal(neutered.factor, 1.2) // 1.4 − 0.2
  })
})

describe('calculateNutrition — v2 BCS 처리 (가산·IBW 감량 분기)', () => {
  it('BCS 2 (저체중) — +0.2 가산: 1.4+0.2(미중성화)−0.1(중년)+0.2 = 1.7', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers({ bcsExact: 2 }),
    )
    assert.equal(r.factor, 1.7)
    assert.ok(r.riskFlags.includes('SEVERE_UNDERWEIGHT'))
  })

  it('BCS 9 (비만) — 이상체중(10/1.4=7.14kg)으로 RER 재계산 × 1.0', () => {
    const r = calculateNutrition(
      baseDog({ ageValue: 8 }),
      baseAnswers({ bcsExact: 9 }),
    )
    assert.equal(r.factor, 1.0)
    assert.equal(r.idealWeightKg, 7.14)
    assert.equal(r.rer, Math.round(70 * Math.pow(7.14, 0.75)))
    assert.equal(r.mer, Math.round(70 * Math.pow(7.14, 0.75)))
    assert.ok(r.riskFlags.includes('SEVERE_OBESITY'))
  })

  it('BCS 1 (refeeding 위험) — 저체중 +0.2 가산 없이 baseline 유지', () => {
    const r = calculateNutrition(
      baseDog(),
      baseAnswers({ bcsExact: 1 }),
    )
    assert.equal(r.factor, 1.6) // 1.4 + 0.2(미중성화) — 저체중 가산 skip
    assert.ok(r.riskFlags.includes('REFEEDING_RISK'))
  })
})

describe('calculateNutrition — v2 2b 설문 신호 (easy-keeper·증거 게이트·한랭)', () => {
  it('쉽게 찌는 체질 → −0.1: 중성화 5세 = 1.4 − 0.1 = 1.3', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ isEasyKeeper: true }),
    )
    assert.equal(r.factor, 1.3)
  })

  it('격한 운동 기록·측정 → +0.2 (객관 증거 게이트 통과)', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ vigorousExercise: 'objective' }),
    )
    assert.equal(r.factor, 1.6) // 1.4 + 0.2
  })

  it('격한 운동 느낌상 → +0.1 상한 (자가보고)', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ vigorousExercise: 'self_report' }),
    )
    assert.equal(r.factor, 1.5)
  })

  it('실외+한랭 → +0.15, 실내+한랭 → 무보정 (게이트: 실외 거주 동시)', () => {
    const out = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ housing: 'outdoor', coldExposure: true }),
    )
    assert.equal(out.factor, 1.55)
    const indoor = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ housing: 'indoor', coldExposure: true }),
    )
    assert.equal(indoor.factor, 1.4)
  })

  it("격한 운동 '안 해요' → 프로필 high 여도 가산 억제 (설문이 최신 신호)", () => {
    const r = calculateNutrition(
      baseDog({ neutered: true, activityLevel: 'high' }),
      baseAnswers({ vigorousExercise: 'none' }),
    )
    assert.equal(r.factor, 1.4)
  })

  it('미응답 → 전부 무보정 (하위호환): 중성화 5세 = 1.4', () => {
    const r = calculateNutrition(baseDog({ neutered: true }), baseAnswers())
    assert.equal(r.factor, 1.4)
  })
})

describe('calculateNutrition — v2 4단계 견종 플래그', () => {
  it('래브라도(OB) → easy-keeper 감산: 1.4 − 0.1 = 1.3', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true, breed: '래브라도 리트리버', weight: 30 }),
      baseAnswers(),
    )
    assert.equal(r.factor, 1.3)
  })

  it('견종 OB + 설문 easy-keeper 동시 → 감산 1회만 (이중차감 금지)', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true, breed: '래브라도 리트리버', weight: 30 }),
      baseAnswers({ isEasyKeeper: true }),
    )
    assert.equal(r.factor, 1.3) // −0.1 한 번만
  })

  it('시츄(BRA) — 격한 운동 자가보고여도 활동 가산 억제 → 1.4', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true, breed: '시츄', weight: 5 }),
      baseAnswers({ vigorousExercise: 'self_report' }),
    )
    assert.equal(r.factor, 1.4)
  })

  it('토이 자견(토이푸들) — 정확식 589 × 0.85 = 501 (스펙 T4 완전판)', () => {
    const r = calculateNutrition(
      baseDog({
        weight: 3,
        ageValue: 5,
        ageUnit: 'months',
        expectedAdultWeight: 8,
        breed: '토이푸들',
      }),
      baseAnswers(),
    )
    assert.equal(r.mer, 501)
  })

  it('진돗개(HD) — 감산·가산 없음: 중성화 1.4 그대로', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true, breed: '진돗개', weight: 18 }),
      baseAnswers(),
    )
    assert.equal(r.factor, 1.4)
  })
})

describe('needsCalorieVetRoute — v2 2e 수의 상담 배너 판정', () => {
  it('임신/수유·대사질환 플래그 → true, 일반 플래그 → false', () => {
    assert.equal(needsCalorieVetRoute(['PREGNANT']), true)
    assert.equal(needsCalorieVetRoute(['CKD_DIET_REQUIRED']), true)
    assert.equal(needsCalorieVetRoute(['OVERWEIGHT', 'JOINT_SUPPORT']), false)
    assert.equal(needsCalorieVetRoute([]), false)
    assert.equal(needsCalorieVetRoute(null), false)
  })
})

describe('calculateNutrition — v2 2d 간식 kcal 신고 (10% 캡)', () => {
  it('신고 30kcal (캡 이내) → 그만큼만 밥에서 차감', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ snackFreq: '매일', treatKcalPerDay: 30 }),
    )
    // MER 1.4 × 393.64 = 551. 캡 55.1 > 30 → 차감 30 → foodKcal 521.
    assert.equal(r.mer, 551)
    assert.equal(r.feedG, Math.round((551 - 30) / AVG_ENERGY_DENSITY_KCAL_PER_G))
    assert.ok(!r.riskFlags.includes('TREAT_EXCESS'))
  })

  it('신고 200kcal (캡 초과) → 캡(10%)까지만 차감 + TREAT_EXCESS 식별', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ snackFreq: '매일', treatKcalPerDay: 200 }),
    )
    const cap = r.mer * 0.1
    assert.equal(r.feedG, Math.round((r.mer - cap) / AVG_ENERGY_DENSITY_KCAL_PER_G))
    assert.ok(r.riskFlags.includes('TREAT_EXCESS'))
    assert.ok(r.riskFlags.includes('TREAT_LOAD_DAILY'))
  })

  it('미신고 → 빈도 추정 유지 (매일 = 10%)', () => {
    const r = calculateNutrition(
      baseDog({ neutered: true }),
      baseAnswers({ snackFreq: '매일' }),
    )
    assert.equal(r.feedG, Math.round(r.mer * 0.9 / AVG_ENERGY_DENSITY_KCAL_PER_G))
    assert.ok(r.riskFlags.includes('TREAT_LOAD_DAILY'))
  })
})

describe('calculateNutrition — v2 2c 자견 NRC 정확식 (앞 상수 130)', () => {
  it('3kg 자견 / 성견예상 8kg → 정확식 589 kcal (스펙 T4, 토이 하향 전)', () => {
    const r = calculateNutrition(
      baseDog({
        weight: 3,
        ageValue: 5,
        ageUnit: 'months',
        expectedAdultWeight: 8,
      }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'puppy')
    // 130×3^0.75×3.2×(e^(−0.87×0.375)−0.1) = 589.47 → round 589.
    // (70 이면 317 — 46% 과소. 상수 130 회귀 가드.)
    assert.equal(r.mer, 589)
  })

  it('성견 예상체중 미입력 → 간이 근사 폴백 (5개월 ×2.5)', () => {
    const r = calculateNutrition(
      baseDog({ weight: 3, ageValue: 5, ageUnit: 'months' }),
      baseAnswers(),
    )
    assert.equal(r.factor, 2.5)
  })

  it('현재체중 ≥ 성견예상 (p=1 클램프) — 성장 말기 완만 수렴', () => {
    const r = calculateNutrition(
      baseDog({
        weight: 9,
        ageValue: 11,
        ageUnit: 'months',
        expectedAdultWeight: 8,
      }),
      baseAnswers(),
    )
    assert.equal(r.stage, 'puppy')
    // p 클램프 1 → 130×9^0.75×3.2×(e^−0.87 − 0.1) ≈ 690 (RER×1.9 급 — 성장 tail)
    assert.ok(r.mer > 600 && r.mer < 780, `mer=${r.mer}`)
  })
})

describe('calculateNutrition — pregnancy/lactation gender 게이트', () => {
  it('수컷에 lactating 입력 — 무시 (factor 폭주 차단)', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'male' }),
      baseAnswers({ pregnancyStatus: 'lactating' }),
    )
    // 수컷은 lactating 무시 → v2 사다리 1.4 + 0.2(미중성화) = 1.6 만 적용
    assert.equal(r.factor, 1.6)
    assert.ok(!r.riskFlags.includes('LACTATING'))
  })

  it('중성화 암컷에 pregnant — 무시', () => {
    const r = calculateNutrition(
      baseDog({ gender: 'female', neutered: true }),
      baseAnswers({ pregnancyStatus: 'pregnant' }),
    )
    // 중성화 암컷 — v2 BASE 1.4 그대로 (중성화는 BASE 에 포함, 곱셈 0.9 폐기).
    assert.equal(r.factor, 1.4)
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
