import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAnalysisPrompt, type AiAnalysisContext } from './ai-prompt.ts'

/**
 * 사장님 제보(2026-07-26): 새로 등록한 강아지(아직 파머스테일 안 먹임)에게
 * AI 코멘트가 "이미 먹이고 있는 사람" 전제로 쓰였다.
 * 프롬프트가 급여 단계를 명확히 구분하는지 고정한다.
 */

function baseCtx(overrides: Partial<AiAnalysisContext>): AiAnalysisContext {
  return {
    dogName: '푸린',
    breed: '말티즈',
    ageValue: 3,
    ageUnit: 'years',
    weight: 4,
    neutered: true,
    activity: 'medium',
    stage: '성견',
    bcsLabel: '이상 체형',
    bcsScore: 5,
    mcsScore: null,
    bristolScore: null,
    mer: 300,
    feedG: 200,
    proteinPct: 30,
    fatPct: 15,
    carbPct: 40,
    fiberPct: 4,
    caPRatio: 1.2,
    supplements: [],
    chronicConditions: [],
    currentMedications: [],
    currentFoodBrand: null,
    pregnancyStatus: null,
    coatCondition: null,
    appetite: null,
    dailyWalkMinutes: null,
    riskFlags: [],
    prevBcsScore: null,
    breedSize: '초소형',
    prevFeedG: null,
    prevStage: null,
    daysSinceLast: null,
    daysUntilBirthday: null,
    turningAge: null,
    feedingStarted: false,
    ...overrides,
  }
}

test('★ 아직 시작 안 한 강아지 — user 메시지가 급여 전이라고 명시한다', () => {
  const { user } = buildAnalysisPrompt(baseCtx({ feedingStarted: false }))
  assert.match(user, /아직 파머스테일을 시작하지 않은 아이/)
  assert.doesNotMatch(user, /이미 파머스테일을 먹고 있는/)
})

test('★ 급여 중인 강아지 — user 메시지가 급여 중이라고 명시한다', () => {
  const { user } = buildAnalysisPrompt(baseCtx({ feedingStarted: true }))
  assert.match(user, /이미 파머스테일을 먹고 있는 아이/)
  assert.doesNotMatch(user, /아직 파머스테일을 시작하지 않은/)
})

test('시스템 프롬프트에 급여 단계별 톤 규칙이 항상 들어 있다', () => {
  const { system } = buildAnalysisPrompt(baseCtx({}))
  // 두 단계 모두를 안내하는 규칙이 존재해야 AI 가 분기할 수 있다.
  assert.match(system, /급여 단계에 맞게 말하세요/)
  assert.match(system, /이미 먹이고 있다는 전제의 표현을 절대 쓰지 마세요/)
})

test('급여 단계는 다른 컨텍스트 필드와 독립적이다(질환 여부와 무관)', () => {
  const sick = buildAnalysisPrompt(
    baseCtx({ feedingStarted: false, chronicConditions: ['kidney'] }),
  )
  assert.match(sick.user, /아직 파머스테일을 시작하지 않은 아이/)
})
