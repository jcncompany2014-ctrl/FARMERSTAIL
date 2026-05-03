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
