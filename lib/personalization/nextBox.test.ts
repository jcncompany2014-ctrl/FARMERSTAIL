/**
 * decideNextBox — 다음 cycle 비율 결정 알고리즘 v1 단위 테스트.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decideNextBox } from './nextBox.ts'
import type {
  AlgorithmInput,
  Checkin,
  Formula,
  NextBoxInput,
} from './types.ts'

function baseSurvey(): AlgorithmInput {
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

function basePreviousFormula(): Formula {
  return {
    lineRatios: { basic: 0.5, weight: 0.1, skin: 0.2, premium: 0.1, joint: 0.1 },
    toppers: { protein: 0, vegetable: 0.1 },
    reasoning: [],
    transitionStrategy: 'gradual',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
  }
}

function checkin(
  checkpoint: 'week_2' | 'week_4',
  scores: Partial<{
    stool: number
    coat: number
    appetite: number
    satisfaction: number
  }>,
): Checkin {
  return {
    cycleNumber: 1,
    checkpoint,
    stoolScore: (scores.stool as Checkin['stoolScore']) ?? null,
    coatScore: (scores.coat as Checkin['coatScore']) ?? null,
    appetiteScore: (scores.appetite as Checkin['appetiteScore']) ?? null,
    overallSatisfaction:
      (scores.satisfaction as Checkin['overallSatisfaction']) ?? null,
    respondedAt: '2026-06-01T00:00:00Z',
  }
}

function ratioSum(r: Record<string, number>): number {
  return Object.values(r).reduce((s, v) => s + v, 0)
}

describe('decideNextBox — 기본 동작', () => {
  it('합 1.0 보장', () => {
    const input: NextBoxInput = {
      previousFormula: basePreviousFormula(),
      checkins: [],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    }
    const f = decideNextBox(input)
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-9)
  })

  it('cycleNumber 전달', () => {
    const input: NextBoxInput = {
      previousFormula: basePreviousFormula(),
      checkins: [],
      surveyInput: baseSurvey(),
      cycleNumber: 5,
    }
    const f = decideNextBox(input)
    assert.equal(f.cycleNumber, 5)
  })

  it('algorithmVersion v1.3 (firstBox 와 통일)', () => {
    const f = decideNextBox({
      previousFormula: basePreviousFormula(),
      checkins: [],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.match(f.algorithmVersion, /^v1\.3/)
  })

  it('cycle 2+ 전환 전략 gradual', () => {
    const f = decideNextBox({
      previousFormula: basePreviousFormula(),
      checkins: [],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.equal(f.transitionStrategy, 'gradual')
  })
})

describe('decideNextBox — 응답 없음 처리', () => {
  it('체크인 없으면 이전 비율 유지', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    // quantize 결과 같아야 함
    for (const line of ['basic', 'weight', 'skin', 'premium', 'joint'] as const) {
      assert.equal(f.lineRatios[line], prev.lineRatios[line])
    }
    const reason = f.reasoning.find((r) => r.ruleId === 'next-no-checkin')
    assert.ok(reason)
  })
})

describe('decideNextBox — 만족도 freeze', () => {
  it('만족도 5 → 큰 변화 없음', () => {
    const prev = basePreviousFormula()
    // 만족도 5 인 강아지에게 안 좋은 신호 (변 무름) 도 같이 보내봐도 freeze 우선.
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [
        checkin('week_4', { stool: 6, coat: 2, satisfaction: 5 }),
      ],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    const reason = f.reasoning.find((r) => r.ruleId === 'next-freeze-satisfied')
    assert.ok(reason, '만족도 freeze 발화')
    // 비율은 거의 변화 없음 (quantize 로 ±0.1 이내)
    for (const line of ['basic', 'weight', 'skin', 'premium', 'joint'] as const) {
      assert.ok(
        Math.abs(f.lineRatios[line] - prev.lineRatios[line]) <= 0.1 + 1e-9,
      )
    }
  })
})

describe('decideNextBox — 변 신호', () => {
  it('week_2 변 무름 (#6) → Skin/Premium ↓, Weight ↑', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_2', { stool: 6 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.ok(f.lineRatios.weight >= prev.lineRatios.weight)
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'next-week2-stool-soft',
    )
    assert.ok(reason)
  })

  it('week_2 + week_4 둘 다 변 무름 → 단일 단백질 collapse', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [
        checkin('week_2', { stool: 6 }),
        checkin('week_4', { stool: 6 }),
      ],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    const nonZero = Object.values(f.lineRatios).filter((v) => v > 0).length
    assert.equal(nonZero, 1, '단일 라인 100%')
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'next-stool-persistent-collapse',
    )
    assert.ok(reason)
  })

  it('week_2 변비 (#2) → 관찰 chip 만 발화', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_2', { stool: 2 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'next-week2-stool-hard',
    )
    assert.ok(reason)
  })
})

describe('decideNextBox — 털 신호', () => {
  it('week_4 털 2/5 → Skin 가산 (basic/weight 에서)', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_4', { coat: 2 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.ok(
      f.lineRatios.skin > prev.lineRatios.skin,
      'Skin 증가',
    )
    const reason = f.reasoning.find((r) => r.ruleId === 'next-coat-low')
    assert.ok(reason)
  })

  it('털 5/5 → 변화 없음', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_4', { coat: 5, satisfaction: 4 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.equal(f.lineRatios.skin, prev.lineRatios.skin)
  })
})

describe('decideNextBox — 식욕 신호', () => {
  it('식욕 2/5 + 선호 단백질 → 그 라인 ↑', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_4', { appetite: 2 })],
      surveyInput: { ...baseSurvey(), preferredProteins: ['salmon'] },
      cycleNumber: 2,
    })
    assert.ok(f.lineRatios.skin >= prev.lineRatios.skin)
    const reason = f.reasoning.find((r) => r.ruleId === 'next-appetite-low')
    assert.ok(reason)
  })

  it('식욕 4+ → 변화 없음', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [checkin('week_4', { appetite: 5 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    const reason = f.reasoning.find((r) => r.ruleId === 'next-appetite-low')
    assert.equal(reason, undefined)
  })
})

describe('decideNextBox — 새 알레르기 (재설문)', () => {
  it('이전 처방의 라인이 새로 알레르기 → 0% 강제', () => {
    const prev = basePreviousFormula() // basic 0.5
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [],
      surveyInput: { ...baseSurvey(), allergies: ['닭·칠면조'] },
      cycleNumber: 2,
    })
    assert.equal(f.lineRatios.basic, 0)
    assert.ok(Math.abs(ratioSum(f.lineRatios) - 1) < 1e-9)
    const reason = f.reasoning.find((r) => r.ruleId === 'next-allergy-basic')
    assert.ok(reason)
  })
})

describe('decideNextBox — 만족도 낮음', () => {
  it('만족도 1-2 → 상담 chip', () => {
    const f = decideNextBox({
      previousFormula: basePreviousFormula(),
      checkins: [checkin('week_4', { satisfaction: 1 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    const reason = f.reasoning.find(
      (r) => r.ruleId === 'next-low-satisfaction',
    )
    assert.ok(reason)
    assert.match(reason!.action, /수의사/)
  })
})

describe('decideNextBox — 복합 시나리오', () => {
  it('단일 collapse 후 토퍼 최소', () => {
    const prev = basePreviousFormula()
    const f = decideNextBox({
      previousFormula: prev,
      checkins: [
        checkin('week_2', { stool: 6 }),
        checkin('week_4', { stool: 6 }),
      ],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    assert.equal(f.toppers.protein, 0)
    assert.ok(f.toppers.vegetable <= 0.05 + 1e-9)
  })

  it('Quantize 정상 동작 (0.1 단위)', () => {
    const f = decideNextBox({
      previousFormula: basePreviousFormula(),
      checkins: [checkin('week_4', { coat: 2 })],
      surveyInput: baseSurvey(),
      cycleNumber: 2,
    })
    for (const v of Object.values(f.lineRatios)) {
      const stepCount = v / 0.1
      assert.ok(Math.abs(stepCount - Math.round(stepCount)) < 1e-9)
    }
  })

  it('reasoning priority 오름차순', () => {
    const f = decideNextBox({
      previousFormula: basePreviousFormula(),
      checkins: [
        checkin('week_2', { stool: 6 }),
        checkin('week_4', {
          stool: 6,
          coat: 2,
          appetite: 2,
          satisfaction: 1,
        }),
      ],
      surveyInput: { ...baseSurvey(), allergies: ['닭·칠면조'] },
      cycleNumber: 2,
    })
    for (let i = 1; i < f.reasoning.length; i++) {
      assert.ok(f.reasoning[i].priority >= f.reasoning[i - 1].priority)
    }
  })
})
