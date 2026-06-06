/**
 * 추천 v3 cutover — "v3 추천 + v2 안전망" 결합 테스트.
 *
 * 핵심: v3 가 베이스 단백질을 시드(baseRatiosOverride)해도, decideFirstBox 의
 * 임상 안전 룰(알레르기·췌장염·CKD·퍼피)이 그 위에서 **그대로 발화**하는지 박제.
 * 안전 후퇴 0 보장.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decideFirstBox } from '../firstBox.ts'
import { v3PicksToLineRatios } from './integrate.ts'
import type { AlgorithmInput, FoodLine } from '../types.ts'
import type { ProteinKey, SkuPick } from './types.ts'

const LINES: FoodLine[] = ['basic', 'weight', 'skin', 'premium', 'joint']
const sumLines = (r: Record<FoodLine, number>) =>
  LINES.reduce((s, l) => s + r[l], 0)

function pick(protein: ProteinKey, ratio: number, isPrimary = true): SkuPick {
  return {
    id: protein,
    protein,
    nameKr: protein,
    ratio,
    kcalPer100g: 130,
    claims: [],
    isPrimary,
  }
}

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

describe('v3PicksToLineRatios — 단백질→라인 1:1', () => {
  it('chicken→weight, pork→joint', () => {
    const r = v3PicksToLineRatios([pick('chicken', 0.7), pick('pork', 0.3, false)])
    assert.equal(r.weight, 0.7)
    assert.equal(r.joint, 0.3)
    assert.equal(r.basic, 0)
    assert.equal(r.premium, 0)
    assert.equal(r.skin, 0)
  })
  it('duck→basic, beef→premium', () => {
    assert.equal(v3PicksToLineRatios([pick('duck', 1)]).basic, 1)
    assert.equal(v3PicksToLineRatios([pick('beef', 1)]).premium, 1)
  })
})

describe('decideFirstBox + v3 시드 (안전망 보존)', () => {
  it('시드가 시작 비율로 사용됨 + goal- ruleId(애널리틱스) + v3 칩', () => {
    const seed = v3PicksToLineRatios([pick('chicken', 1)]) // weight:1
    const f = decideFirstBox(input({ baseRatiosOverride: seed }))
    assert.ok(f.lineRatios.weight > 0)
    assert.ok(
      f.reasoning.some((r) => r.ruleId.startsWith('goal-')),
      'careGoal 추출용 goal- ruleId 보존',
    )
    assert.ok(f.reasoning.some((r) => r.chipLabel === 'v3 맞춤 베이스'))
    assert.ok(Math.abs(sumLines(f.lineRatios) - 1) < 0.001, '합 1 보존')
  })

  it('🛡 알레르기 차단이 v3 시드보다 우선 (소 알레르기 → premium 0)', () => {
    const seed = v3PicksToLineRatios([pick('beef', 1)]) // premium:1
    const f = decideFirstBox(
      input({ baseRatiosOverride: seed, allergies: ['소고기'] }),
    )
    assert.equal(f.lineRatios.premium, 0, '소 알레르기 → premium 차단')
    assert.ok(Math.abs(sumLines(f.lineRatios) - 1) < 0.001)
  })

  it('🛡 췌장염: v3 소(고지방) 시드여도 저지방 닭(weight)으로 이동', () => {
    const seed = v3PicksToLineRatios([pick('beef', 1)])
    const f = decideFirstBox(
      input({ baseRatiosOverride: seed, chronicConditions: ['pancreatitis'] }),
    )
    assert.ok(f.lineRatios.weight > 0, '저지방 닭 라인으로 이동')
    assert.ok(f.reasoning.some((r) => r.ruleId === 'chronic-pancreatitis'))
  })

  it('🛡 CKD(stage3): v3 소 시드여도 premium 0 (저단백)', () => {
    const seed = v3PicksToLineRatios([pick('beef', 1)])
    const f = decideFirstBox(
      input({
        baseRatiosOverride: seed,
        chronicConditions: ['kidney'],
        irisStage: 3,
      }),
    )
    assert.equal(f.lineRatios.premium, 0)
    assert.ok(f.reasoning.some((r) => r.ruleId.startsWith('chronic-kidney')))
  })

  it('🛡 퍼피(6개월): v3 시드여도 joint/weight 차단(성장기)', () => {
    const seed = v3PicksToLineRatios([pick('chicken', 0.5), pick('pork', 0.5, false)])
    const f = decideFirstBox(input({ baseRatiosOverride: seed, ageMonths: 6 }))
    assert.equal(f.lineRatios.joint, 0)
    assert.equal(f.lineRatios.weight, 0)
    assert.ok(f.reasoning.some((r) => r.ruleId === 'age-puppy'))
  })

  it('빈 시드 → 케어목표 레시피로 안전 폴백', () => {
    const empty: Record<FoodLine, number> = {
      basic: 0,
      weight: 0,
      skin: 0,
      premium: 0,
      joint: 0,
    }
    const f = decideFirstBox(
      input({ baseRatiosOverride: empty, careGoal: 'weight_management' }),
    )
    assert.ok(f.reasoning.some((r) => r.ruleId === 'goal-weight_management'))
    assert.ok(f.lineRatios.weight > 0)
  })

  it('시드 미입력 → 완전 하위호환(기존 v2 케어목표 레시피)', () => {
    const f = decideFirstBox(input({ careGoal: 'weight_management' }))
    assert.ok(f.reasoning.some((r) => r.ruleId === 'goal-weight_management'))
    assert.ok(!f.reasoning.some((r) => r.chipLabel === 'v3 맞춤 베이스'))
  })
})

describe('🛡 mass 보존 — basic=0 시드에서도 임상 floor 달성 (chip 진실)', () => {
  // 수정 전(leaky basic-only): premium 시드 + 당뇨 → weight 0.4 가 normalize 로
  // ~0.3 으로 희석 + chip 거짓. 수정 후(transferToTarget 전 라인 donor): 0.4 도달.
  it('당뇨 + 소(premium) 시드 → weight 임상 floor(~0.4) 달성', () => {
    const seed = v3PicksToLineRatios([pick('beef', 1)]) // premium:1, basic:0
    const f = decideFirstBox(
      input({ baseRatiosOverride: seed, chronicConditions: ['diabetes'] }),
    )
    assert.ok(
      f.lineRatios.weight >= 0.39,
      `당뇨 weight floor 달성 (현재 ${f.lineRatios.weight})`,
    )
    assert.ok(Math.abs(sumLines(f.lineRatios) - 1) < 0.001, '합 1 보존')
  })

  it('EPI + 닭(weight) 시드 → premium 임상 floor(~0.3) 달성', () => {
    const seed = v3PicksToLineRatios([pick('chicken', 1)]) // weight:1, basic:0
    const f = decideFirstBox(
      input({ baseRatiosOverride: seed, chronicConditions: ['epi'] }),
    )
    assert.ok(
      f.lineRatios.premium >= 0.29,
      `EPI premium floor 달성 (현재 ${f.lineRatios.premium})`,
    )
    assert.ok(Math.abs(sumLines(f.lineRatios) - 1) < 0.001)
  })

  it('갑상선저하 + 소 시드(basic=0) → weight floor + 합 1', () => {
    const seed = v3PicksToLineRatios([pick('beef', 1)])
    const f = decideFirstBox(
      input({ baseRatiosOverride: seed, chronicConditions: ['hypothyroid'] }),
    )
    assert.ok(f.lineRatios.weight >= 0.29)
    assert.ok(Math.abs(sumLines(f.lineRatios) - 1) < 0.001)
  })
})
