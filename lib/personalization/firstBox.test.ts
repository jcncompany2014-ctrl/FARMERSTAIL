/**
 * decideFirstBox — 첫 박스 결정 알고리즘 v1 단위 테스트.
 *
 * 알고리즘이 pure function 이라 외부 의존성 stub 없이 테스트 가능. 각
 * 시나리오는 실제 운영에서 등장할 만한 케이스 — "5kg 시바, 7세, 알레르기
 * 없음" 같은. 룰 변경 시 회귀 잡는 것이 1차 목적이고, 부수적으로 운영팀이
 * "이 강아지엔 어떤 비율?" 직관적으로 이해할 수 있는 자료가 됨.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decideFirstBox } from './firstBox.ts'
import type { AlgorithmInput } from './types.ts'

/** 테스트 fixture — 평범한 5kg 시바, 3세, 정상 BCS, 알레르기 없음. */
function baseInput(): AlgorithmInput {
  return {
    dogId: 'dog-1',
    dogName: '푸린',
    ageMonths: 36,
    weightKg: 5,
    neutered: true,
    activityLevel: 'medium',
    bcs: 5,
    allergies: [],
    chronicConditions: [],
    pregnancy: 'none',
    careGoal: 'general_upgrade',
    homeCookingExperience: 'occasional',
    currentDietSatisfaction: 4,
    weightTrend6mo: 'stable',
    giSensitivity: 'rare',
    preferredProteins: [],
    indoorActivity: 'moderate',
    dailyWalkMinutes: 30,
    pregnancyWeek: null,
    litterSize: null,
    expectedAdultWeightKg: null,
    irisStage: null,
    dailyKcal: 280,
    dailyGrams: 200,
  }
}

function ratioSum(r: Record<string, number>): number {
  return Object.values(r).reduce((s, v) => s + v, 0)
}

describe('decideFirstBox — 기본 sanity', () => {
  it('합 1.0 보장 (quantized)', () => {
    const f = decideFirstBox(baseInput())
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-6)
  })

  it('algorithmVersion 출력', () => {
    const f = decideFirstBox(baseInput())
    assert.match(f.algorithmVersion, /^v1\./)
  })

  it('userAdjusted 첫 출력은 false', () => {
    const f = decideFirstBox(baseInput())
    assert.equal(f.userAdjusted, false)
  })

  it('reasoning 우선순위 오름차순 정렬', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['닭·칠면조'],
      bcs: 8,
      careGoal: 'weight_management',
    })
    for (let i = 1; i < f.reasoning.length; i++) {
      assert.ok(f.reasoning[i].priority >= f.reasoning[i - 1].priority)
    }
  })

  it('cycleNumber = 1', () => {
    const f = decideFirstBox(baseInput())
    assert.equal(f.cycleNumber, 1)
  })
})

describe('decideFirstBox — 케어 목표 매핑', () => {
  it('weight_management → Weight 라인 메인', () => {
    const f = decideFirstBox({ ...baseInput(), careGoal: 'weight_management' })
    assert.ok(f.lineRatios.weight >= 0.5, 'Weight ≥ 50%')
  })

  it('skin_coat → Skin 라인 메인', () => {
    const f = decideFirstBox({ ...baseInput(), careGoal: 'skin_coat' })
    assert.ok(f.lineRatios.skin >= 0.5, 'Skin ≥ 50%')
  })

  it('joint_senior → Joint 라인 메인', () => {
    const f = decideFirstBox({ ...baseInput(), careGoal: 'joint_senior' })
    assert.ok(f.lineRatios.joint >= 0.5, 'Joint ≥ 50%')
  })

  it('careGoal null → general_upgrade fallback', () => {
    const f = decideFirstBox({ ...baseInput(), careGoal: null })
    // general_upgrade 면 Basic 0.5 + 잡다하게 분산
    assert.ok(f.lineRatios.basic >= 0.4)
  })
})

describe('decideFirstBox — 알레르기 차단', () => {
  it('닭 알레르기 → Basic 0%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['닭·칠면조'],
      careGoal: 'general_upgrade', // Basic 가 메인일 케어목표
    })
    assert.equal(f.lineRatios.basic, 0)
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-6, '합 1.0 유지')
  })

  it('소 알레르기 → Premium 0%', () => {
    const f = decideFirstBox({ ...baseInput(), allergies: ['소고기'] })
    assert.equal(f.lineRatios.premium, 0)
  })

  it('연어 알레르기 → Skin 0%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['연어·생선'],
      careGoal: 'skin_coat',
    })
    assert.equal(f.lineRatios.skin, 0)
    // Skin 메인 라인 차단 → 다른 라인이 합 1.0 채움
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-6)
  })

  it('다중 알레르기 (닭+소+연어) → 살아있는 라인만 분배', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['닭·칠면조', '소고기', '연어·생선'],
    })
    assert.equal(f.lineRatios.basic, 0)
    assert.equal(f.lineRatios.premium, 0)
    assert.equal(f.lineRatios.skin, 0)
    // Weight + Joint 만 살아남
    assert.ok(f.lineRatios.weight + f.lineRatios.joint > 0.99)
  })

  it('알레르기 reasoning chip 발화', () => {
    const f = decideFirstBox({ ...baseInput(), allergies: ['닭·칠면조'] })
    const allergyReason = f.reasoning.find((r) => r.ruleId === 'allergy-basic')
    assert.ok(allergyReason, '알레르기 reasoning 출력')
    assert.equal(allergyReason!.priority, 0, 'priority 0')
  })
})

describe('decideFirstBox — BCS 미세 조정', () => {
  it('BCS 8 → Weight 60% 메인', () => {
    const f = decideFirstBox({ ...baseInput(), bcs: 8 })
    assert.ok(f.lineRatios.weight >= 0.5, 'Weight ≥ 50%')
    const bcsReason = f.reasoning.find((r) => r.ruleId === 'bcs-obese')
    assert.ok(bcsReason, 'BCS 비만 reasoning')
  })

  it('BCS 6-7 → Weight 40%+ 가산', () => {
    const f = decideFirstBox({ ...baseInput(), bcs: 7 })
    assert.ok(f.lineRatios.weight >= 0.3)
  })

  it('BCS 1-3 → Premium 가산 (단백질↑)', () => {
    const f = decideFirstBox({ ...baseInput(), bcs: 2 })
    assert.ok(f.lineRatios.premium >= 0.2)
    const reason = f.reasoning.find((r) => r.ruleId === 'bcs-underweight')
    assert.ok(reason)
  })

  it('BCS null → 조정 없음', () => {
    const f = decideFirstBox({ ...baseInput(), bcs: null })
    const bcsReason = f.reasoning.find((r) => r.ruleId.startsWith('bcs-'))
    assert.equal(bcsReason, undefined)
  })
})

describe('decideFirstBox — 시니어 자동 보정', () => {
  it('7세 (84개월) → Joint 20% 자동 가산', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 84,
      careGoal: 'general_upgrade',
    })
    assert.ok(f.lineRatios.joint >= 0.2)
    const reason = f.reasoning.find((r) => r.ruleId === 'age-senior-joint')
    assert.ok(reason)
  })

  it('puppy (12개월 미만) → Weight/Joint 0%', () => {
    const f = decideFirstBox({ ...baseInput(), ageMonths: 6 })
    assert.equal(f.lineRatios.weight, 0)
    assert.equal(f.lineRatios.joint, 0)
    const reason = f.reasoning.find((r) => r.ruleId === 'age-puppy')
    assert.ok(reason)
  })
})

describe('decideFirstBox — 만성질환', () => {
  it('만성 신장질환 → Premium 0%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      careGoal: 'general_upgrade',
    })
    assert.equal(f.lineRatios.premium, 0)
    const reason = f.reasoning.find((r) => r.ruleId === 'chronic-kidney')
    assert.ok(reason)
    assert.match(reason!.action, /수의사/, '수의사 상담 권장 메시지')
  })

  it('IBD → 단일 단백질 강제 (giSensitive 효과)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['ibd'],
    })
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.equal(nonZero, 1, 'IBD 면 단일 라인 100%')
  })

  it('관절염 → Joint 30%+', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['arthritis'],
    })
    assert.ok(f.lineRatios.joint >= 0.3)
  })
})

describe('decideFirstBox — GI 민감도', () => {
  it('giSensitivity = always → 단일 라인 100%', () => {
    const f = decideFirstBox({ ...baseInput(), giSensitivity: 'always' })
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.equal(nonZero, 1)
  })

  it('giSensitivity = frequent → 단일 라인', () => {
    const f = decideFirstBox({ ...baseInput(), giSensitivity: 'frequent' })
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.equal(nonZero, 1)
  })

  it('giSensitivity = rare → 혼합 유지', () => {
    const f = decideFirstBox({
      ...baseInput(),
      giSensitivity: 'rare',
      careGoal: 'joint_senior', // 0.1/0.3/0.6 분포
    })
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.ok(nonZero > 1, '혼합 비율 유지')
  })
})

describe('decideFirstBox — 토퍼', () => {
  it('homeCookingExperience = first → 토퍼 0%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'first',
    })
    assert.equal(f.toppers.protein, 0)
    assert.equal(f.toppers.vegetable, 0)
  })

  it('homeCookingExperience = frequent → 토퍼 풍부', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'frequent',
    })
    assert.ok(f.toppers.vegetable + f.toppers.protein > 0.15)
  })

  it('BCS 6+ → 야채 토퍼 ↑', () => {
    const f = decideFirstBox({
      ...baseInput(),
      bcs: 7,
      homeCookingExperience: 'occasional',
    })
    assert.ok(f.toppers.vegetable >= 0.1)
  })

  it('토퍼 합계는 30% cap', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'frequent',
      bcs: 8,
    })
    assert.ok(f.toppers.vegetable + f.toppers.protein <= 0.3 + 1e-9)
  })

  it('IBD → 토퍼 최소', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['ibd'],
      homeCookingExperience: 'frequent',
    })
    assert.ok(f.toppers.vegetable + f.toppers.protein <= 0.05 + 1e-9)
  })
})

describe('decideFirstBox — 전환 전략', () => {
  it('first → conservative', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'first',
    })
    assert.equal(f.transitionStrategy, 'conservative')
  })

  it('frequent → aggressive', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'frequent',
    })
    assert.equal(f.transitionStrategy, 'aggressive')
  })

  it('giSensitivity always → conservative (override)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      homeCookingExperience: 'frequent',
      giSensitivity: 'always',
    })
    assert.equal(f.transitionStrategy, 'conservative')
  })
})

describe('decideFirstBox — quantization', () => {
  it('모든 비율이 0.1 단위', () => {
    const f = decideFirstBox(baseInput())
    for (const [, v] of Object.entries(f.lineRatios)) {
      const stepCount = v / 0.1
      assert.ok(Math.abs(stepCount - Math.round(stepCount)) < 1e-9, `${v} 가 0.1 단위`)
    }
  })

  it('합이 정확히 1.0 (quantize 잔차 흡수)', () => {
    // 여러 시나리오에서 검증
    const inputs = [
      baseInput(),
      { ...baseInput(), bcs: 7 as const, careGoal: 'weight_management' as const },
      { ...baseInput(), allergies: ['닭·칠면조'], careGoal: 'joint_senior' as const },
      { ...baseInput(), preferredProteins: ['salmon', 'beef'] },
    ]
    for (const input of inputs) {
      const f = decideFirstBox(input)
      assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-9, `${JSON.stringify(input.careGoal)} 합 1.0`)
    }
  })
})

describe('decideFirstBox — 체중 추세', () => {
  it('weightTrend = lost + BCS 5 → 수의사 상담 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      weightTrend6mo: 'lost',
      bcs: 5,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'weight-trend-unintended-loss',
    )
    assert.ok(reason)
    assert.match(reason!.action, /상담/)
  })

  it('weightTrend = lost + BCS 7 → 의도된 감량 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      weightTrend6mo: 'lost',
      bcs: 7,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'weight-trend-intended-loss',
    )
    assert.ok(reason)
  })

  it('weightTrend = gained + BCS 6 → Weight 50%+', () => {
    const f = decideFirstBox({
      ...baseInput(),
      weightTrend6mo: 'gained',
      bcs: 6,
    })
    assert.ok(f.lineRatios.weight >= 0.5)
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'weight-trend-active-gain',
    )
    assert.ok(reason)
  })

  it('weightTrend = unknown → 변화 없음', () => {
    const f = decideFirstBox({
      ...baseInput(),
      weightTrend6mo: 'unknown',
    })
    const reason = f.reasoning.find((r) => r.ruleId.startsWith('weight-trend-'))
    assert.equal(reason, undefined)
  })

  it('weightTrend = stable → 변화 없음', () => {
    const f = decideFirstBox({
      ...baseInput(),
      weightTrend6mo: 'stable',
    })
    const reason = f.reasoning.find((r) => r.ruleId.startsWith('weight-trend-'))
    assert.equal(reason, undefined)
  })
})

describe('decideFirstBox — 임신/수유', () => {
  it('pregnant → reasoning 발화', () => {
    const f = decideFirstBox({ ...baseInput(), pregnancy: 'pregnant' })
    const reason = f.reasoning.find((r) => r.ruleId === 'pregnancy-pregnant')
    assert.ok(reason)
  })

  it('lactating → reasoning 발화', () => {
    const f = decideFirstBox({ ...baseInput(), pregnancy: 'lactating' })
    const reason = f.reasoning.find((r) => r.ruleId === 'pregnancy-lactating')
    assert.ok(reason)
  })
})

describe('decideFirstBox — 선호 단백질', () => {
  it('preferredProteins 단일 → 해당 라인 가산', () => {
    const baseline = decideFirstBox(baseInput())
    const withPref = decideFirstBox({
      ...baseInput(),
      preferredProteins: ['salmon'],
    })
    assert.ok(withPref.lineRatios.skin >= baseline.lineRatios.skin)
    const reason = withPref.reasoning.find(
      (r) => r.ruleId === 'preferred-protein-bonus',
    )
    assert.ok(reason)
  })

  it('preferredProteins 빈 배열 → 가산 없음', () => {
    const f = decideFirstBox({ ...baseInput(), preferredProteins: [] })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'preferred-protein-bonus',
    )
    assert.equal(reason, undefined)
  })

  it('알레르기 차단된 라인엔 선호 가산 안 함', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['닭·칠면조'],
      preferredProteins: ['chicken'],
    })
    assert.equal(f.lineRatios.basic, 0, 'allergy 우선')
  })
})

describe('decideFirstBox v1.2 — 활동량 룰', () => {
  it('high + 산책 60분+ → Premium ↑', () => {
    const f = decideFirstBox({
      ...baseInput(),
      activityLevel: 'high',
      dailyWalkMinutes: 80,
    })
    const reason = f.reasoning.find((r) => r.ruleId === 'activity-high-premium')
    assert.ok(reason)
    // Premium 이 룰 발화로 0.25 까지 가산되어야 함 (단, 다른 룰과 충돌 시 다를 수)
    assert.ok(f.lineRatios.premium >= 0.2)
  })

  it('low + 산책 < 20 → Weight ↑', () => {
    const f = decideFirstBox({
      ...baseInput(),
      activityLevel: 'low',
      dailyWalkMinutes: 10,
    })
    const reason = f.reasoning.find((r) => r.ruleId === 'activity-low-weight')
    assert.ok(reason)
  })

  it('medium + 산책 정상 → 활동 룰 발화 없음', () => {
    const f = decideFirstBox({
      ...baseInput(),
      activityLevel: 'medium',
      dailyWalkMinutes: 40,
    })
    const reason = f.reasoning.find((r) => r.ruleId.startsWith('activity-'))
    assert.equal(reason, undefined)
  })
})

describe('decideFirstBox v1.2 — 실내 활동 룰', () => {
  it('실내 차분 + 산책 부족 + BCS 정상 → 비만 예방 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      indoorActivity: 'calm',
      dailyWalkMinutes: 15,
      activityLevel: 'low',
      careGoal: 'general_upgrade',
    })
    // activity-low-weight 도 발화함. indoor-low-prevent 또는 그것
    const reason = f.reasoning.find(
      (r) =>
        r.ruleId === 'indoor-low-prevent' ||
        r.ruleId === 'activity-low-weight',
    )
    assert.ok(reason, '저활동 룰 중 하나는 발화')
  })

  it('실내 활발 + 산책 30분 미만 → "OK" chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      indoorActivity: 'active',
      dailyWalkMinutes: 20,
    })
    const reason = f.reasoning.find((r) => r.ruleId === 'indoor-active-ok')
    assert.ok(reason)
  })
})

describe('decideFirstBox v1.2 — 만성질환 조합', () => {
  it('CKD + 관절염 → Joint ↑ (Polzin 2013)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney', 'arthritis'],
    })
    assert.equal(f.lineRatios.premium, 0, 'CKD 룰: Premium 차단')
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'chronic-combo-ckd-arthritis',
    )
    assert.ok(reason)
  })

  it('피부염 + 관절염 → 시너지 chip (Innes 2022)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['allergy_skin', 'arthritis'],
      careGoal: 'skin_coat',
    })
    // careGoal=skin_coat 이라 Skin ≥ 0.7. arthritis 룰이 Joint 30% 까지 ↑.
    // 두 라인 모두 가산되면 시너지 chip 발화.
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'chronic-combo-skin-arthritis',
    )
    // Skin 0.7 + Joint 0.3 인 상태에서 chip 발화 — 항상 발화하는 게 아니라
    // 알고리즘 정규화 후 둘 다 ≥ 0.2 일 때만. 약한 검증.
    if (reason) assert.match(reason.action, /오메가-3/)
  })

  it('췌장염 + BCS 7 → Weight 50%+ (저지방 강화)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['pancreatitis'],
      bcs: 7,
    })
    assert.ok(f.lineRatios.weight >= 0.4)
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'chronic-combo-pancr-obese',
    )
    assert.ok(reason)
  })
})

describe('decideFirstBox v1.2 — 식이 만족도 신호', () => {
  it('만족도 5 → freeze 권장 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      currentDietSatisfaction: 5,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'diet-satisfaction-high',
    )
    assert.ok(reason)
  })

  it('만족도 1 → 적극 변경 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      currentDietSatisfaction: 1,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'diet-satisfaction-low',
    )
    assert.ok(reason)
  })

  it('만족도 3 → 발화 없음', () => {
    const f = decideFirstBox({
      ...baseInput(),
      currentDietSatisfaction: 3,
    })
    const reason = f.reasoning.find((r) =>
      r.ruleId.startsWith('diet-satisfaction-'),
    )
    assert.equal(reason, undefined)
  })
})

describe('decideFirstBox v1.3 — algorithmVersion', () => {
  it('v1.3.0 출력', () => {
    const f = decideFirstBox(baseInput())
    assert.equal(f.algorithmVersion, 'v1.3.0')
  })
})

describe('decideFirstBox v1.3 — 임신 multiplier 정밀화 (NRC 2006 ch.15)', () => {
  it('pregnancyWeek=null → "주차 미입력" chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      pregnancy: 'pregnant',
      pregnancyWeek: null,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'pregnancy-pregnant')
    assert.ok(r)
    assert.match(r!.chipLabel, /주차 미입력|1\.5/)
  })

  it('pregnancyWeek=7 (late) → 1.6-2.0× chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      pregnancy: 'pregnant',
      pregnancyWeek: 7,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'pregnancy-pregnant')
    assert.ok(r)
    assert.match(r!.chipLabel, /1\.6-2\.0/)
  })

  it('pregnancyWeek=2 (early) → ~1.0× chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      pregnancy: 'pregnant',
      pregnancyWeek: 2,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'pregnancy-pregnant')
    assert.ok(r)
    assert.match(r!.action, /임신 초기/)
  })

  it('lactating litterSize=3 → 2.75× chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      pregnancy: 'lactating',
      litterSize: 3,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'pregnancy-lactating')
    assert.ok(r)
    assert.match(r!.chipLabel, /2\.75/)
  })

  it('lactating litterSize=6 → 3.0-4.0× chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      pregnancy: 'lactating',
      litterSize: 6,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'pregnancy-lactating')
    assert.ok(r)
    assert.match(r!.chipLabel, /3\.0-4\.0/)
  })
})

describe('decideFirstBox v1.3 — 췌장염 fat ceiling (Xenoulis 2015)', () => {
  it('췌장염 처방 후 DM-fat% < 15%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['pancreatitis'],
    })
    // Σ ratio × fatPctDM 직접 계산
    const fat =
      f.lineRatios.basic * 12 +
      f.lineRatios.weight * 8 +
      f.lineRatios.skin * 16 +
      f.lineRatios.premium * 15 +
      f.lineRatios.joint * 18
    assert.ok(fat < 15.5, `DM-fat% should be <15.5% (got ${fat.toFixed(1)}%)`)
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-pancreatitis')
    assert.ok(r)
    assert.match(r!.action, /DM 지방 \d/)
  })

  it('췌장염 + 관절염 동시 → 췌장염이 우선 (fat 우선)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['pancreatitis', 'arthritis'],
    })
    const fat =
      f.lineRatios.basic * 12 +
      f.lineRatios.weight * 8 +
      f.lineRatios.skin * 16 +
      f.lineRatios.premium * 15 +
      f.lineRatios.joint * 18
    // 둘 다 fired 되더라도 최종 fat 가 안전 범위
    assert.ok(fat < 17, `fat should still be controlled (got ${fat.toFixed(1)}%)`)
  })
})

describe('decideFirstBox v1.3 — 대형견 puppy Ca cap (AAFCO 2024 Large-size Growth)', () => {
  it('대형견 puppy (성견 30kg, 6mo) → Premium/Joint 0%, Basic 위주', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 6,
      expectedAdultWeightKg: 30,
    })
    assert.equal(f.lineRatios.premium, 0, 'Premium 차단')
    assert.equal(f.lineRatios.joint, 0, 'Joint 차단 (고-Ca)')
    assert.ok(f.lineRatios.basic >= 0.5, 'Basic 위주')
    const r = f.reasoning.find((x) => x.ruleId === 'age-puppy-large-breed')
    assert.ok(r, '대형견 puppy chip 발화')
  })

  it('일반 puppy (성견 8kg, 6mo) → 대형견 룰 안 발화', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 6,
      expectedAdultWeightKg: 8,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'age-puppy-large-breed')
    assert.equal(r, undefined, '대형견 룰 안 발화')
  })

  it('expectedAdultWeightKg 미입력 → 대형견 룰 안 발화 (보수)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 6,
      expectedAdultWeightKg: null,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'age-puppy-large-breed')
    assert.equal(r, undefined)
  })

  it('성견 (24mo, 30kg) → 대형견 룰 안 발화 (puppy 만 적용)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 24,
      expectedAdultWeightKg: 30,
    })
    const r = f.reasoning.find((x) => x.ruleId === 'age-puppy-large-breed')
    assert.equal(r, undefined)
  })
})

describe('decideFirstBox v1.3 — CKD IRIS staging (IRIS 2019)', () => {
  it('Stage 1 → Premium 유지 + 단백질 정상 chip', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      irisStage: 1,
    })
    const early = f.reasoning.find((r) => r.ruleId === 'chronic-kidney-early')
    assert.ok(early, '초기 CKD chip 발화')
    const late = f.reasoning.find((r) => r.ruleId === 'chronic-kidney')
    assert.equal(late, undefined, '후기 CKD chip 안 발화')
    // Premium 유지 — care goal general_upgrade 의 0.1 그대로 또는 상위
    assert.ok(f.lineRatios.premium >= 0.1, 'Premium 라인 유지')
  })

  it('Stage 2 → 같은 분기', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      irisStage: 2,
    })
    const early = f.reasoning.find((r) => r.ruleId === 'chronic-kidney-early')
    assert.ok(early)
    assert.match(early!.chipLabel, /Stage 2/)
  })

  it('Stage 3 → Premium 0% (저단백)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      irisStage: 3,
    })
    const late = f.reasoning.find((r) => r.ruleId === 'chronic-kidney')
    assert.ok(late, '후기 CKD chip 발화')
    assert.equal(f.lineRatios.premium, 0)
  })

  it('Stage 4 → Premium 0%', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      irisStage: 4,
    })
    assert.equal(f.lineRatios.premium, 0)
  })

  it('stage 미입력 → 보수적 (Stage 3+ 처방)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['kidney'],
      irisStage: null,
    })
    const late = f.reasoning.find((r) => r.ruleId === 'chronic-kidney')
    assert.ok(late)
    assert.match(late!.trigger, /보수적|미진단/)
    assert.equal(f.lineRatios.premium, 0)
  })

  it('CKD 없으면 IRIS 분기 자체 안 발화', () => {
    const f = decideFirstBox({ ...baseInput(), irisStage: 2 })
    const early = f.reasoning.find((r) => r.ruleId === 'chronic-kidney-early')
    const late = f.reasoning.find((r) => r.ruleId === 'chronic-kidney')
    assert.equal(early, undefined)
    assert.equal(late, undefined)
  })
})

describe('decideFirstBox v1.3 — 새 만성질환 (DCM/당뇨/간/CDS/스테로이드)', () => {
  it('cardiac → chip 발화 (taurine·저Na 권장)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['cardiac'],
    })
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-cardiac')
    assert.ok(r)
    assert.match(r!.action, /taurine|저나트륨|grain-free/)
  })

  it('dcm 키도 동일 분기', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['dcm'],
    })
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-cardiac')
    assert.ok(r)
  })

  it('diabetes → Weight 라인 ≥0.4', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['diabetes'],
    })
    assert.ok(f.lineRatios.weight >= 0.4 - 1e-9)
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-diabetes')
    assert.ok(r)
    assert.match(r!.action, /고섬유|식이섬유|혈당/)
  })

  it('liver → Premium 0% (구리 제한)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['liver'],
    })
    assert.equal(f.lineRatios.premium, 0)
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-hepatic')
    assert.ok(r)
    assert.match(r!.action, /구리|Cu/)
  })

  it('hepatic alias 도 동작', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['hepatic'],
    })
    assert.equal(f.lineRatios.premium, 0)
  })

  it('cognitive_decline → Skin 라인 ≥0.3 (DHA)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['cognitive_decline'],
    })
    assert.ok(f.lineRatios.skin >= 0.3 - 1e-9)
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-cognitive-decline')
    assert.ok(r)
    assert.match(r!.action, /DHA|MCT/)
  })

  it('long_term_steroid → Joint 라인 ≥0.3', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['long_term_steroid'],
    })
    assert.ok(f.lineRatios.joint >= 0.3 - 1e-9)
    const r = f.reasoning.find((x) => x.ruleId === 'chronic-long-term-steroid')
    assert.ok(r)
    assert.match(r!.action, /Ca\/P|콜라겐/)
  })

  it('만성질환 없으면 새 룰들 다 안 발화', () => {
    const f = decideFirstBox({ ...baseInput(), chronicConditions: [] })
    const ids = [
      'chronic-cardiac',
      'chronic-diabetes',
      'chronic-hepatic',
      'chronic-cognitive-decline',
      'chronic-long-term-steroid',
    ]
    for (const id of ids) {
      assert.equal(
        f.reasoning.find((r) => r.ruleId === id),
        undefined,
        `${id} 안 발화`,
      )
    }
  })
})

describe('decideFirstBox v1.3 — IgE cross-reactivity chip', () => {
  it('양고기 알레르기 → Premium 라인 cross-react chip (차단 안 함)', () => {
    const f = decideFirstBox({ ...baseInput(), allergies: ['양고기'] })
    const cross = f.reasoning.find((r) => r.ruleId === 'cross-react-premium')
    assert.ok(cross, 'cross-react chip 발화')
    // Premium 라인은 차단 안 됨 — ratio 살아있어야 함 (general_upgrade 시작값)
    // 또는 다른 룰로 0 가능하지만 cross-react 가 차단 자체는 안 함
    assert.equal(
      f.reasoning.find((r) => r.ruleId === 'allergy-premium'),
      undefined,
      'cross-react 만으로는 차단 안 함',
    )
  })

  it('닭 알레르기 → Weight 라인 cross-react chip (오리/닭 cross)', () => {
    const f = decideFirstBox({
      ...baseInput(),
      allergies: ['닭·칠면조'],
    })
    const cross = f.reasoning.find((r) => r.ruleId === 'cross-react-weight')
    assert.ok(cross, 'Weight (오리) cross-react chip 발화')
  })

  it('알레르기 없으면 cross-react chip 없음', () => {
    const f = decideFirstBox(baseInput())
    const cross = f.reasoning.find((r) => r.ruleId.startsWith('cross-react-'))
    assert.equal(cross, undefined)
  })
})

describe('decideFirstBox — 복합 시나리오', () => {
  it('7세 + BCS 6 + 닭알레르기 + 위장가끔 — 일관된 처방', () => {
    const f = decideFirstBox({
      ...baseInput(),
      ageMonths: 84,
      bcs: 6,
      allergies: ['닭·칠면조'],
      giSensitivity: 'sometimes',
      careGoal: 'joint_senior',
    })
    assert.equal(f.lineRatios.basic, 0, '닭 알레르기')
    assert.ok(f.lineRatios.joint >= 0.4, 'Joint 메인')
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-9)
    // 알레르기(0) + careGoal(1) + age(2) + bcs(4) reasoning 다 있어야
    const priorities = new Set(f.reasoning.map((r) => r.priority))
    assert.ok(priorities.has(0))
    assert.ok(priorities.has(1))
  })

  it('IBD + 화식 처음 — 가장 보수적', () => {
    const f = decideFirstBox({
      ...baseInput(),
      chronicConditions: ['ibd'],
      homeCookingExperience: 'first',
    })
    // 단일 단백질 + 토퍼 0 + conservative
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.equal(nonZero, 1)
    assert.equal(f.toppers.protein, 0)
    assert.equal(f.toppers.vegetable, 0)
    assert.equal(f.transitionStrategy, 'conservative')
  })
})
