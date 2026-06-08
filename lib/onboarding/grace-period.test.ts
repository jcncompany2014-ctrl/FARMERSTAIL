/**
 * grace-period.ts characterization tests — Node native test runner.
 *
 * 첫 4주 grace period 의 phase 경계(7/14/21/28일)와 파생 헬퍼의 현재 동작을
 * 고정한다. recommendationSafetyFactor(conservative=0.95)는 추천량에 영향을
 * 주는 임상-인접 값이라, 회귀 방지 차원에서 현재 값을 명시적으로 핀고정한다.
 * (코드 동작 변경 없음 — 순수 회귀 가드.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  onboardingPhase,
  shouldShowAccuracyScore,
  recommendationSafetyFactor,
  shouldShowProactiveNudge,
  type OnboardingPhase,
} from './grace-period.ts'

const DAY = 86_400_000
const CREATED = new Date('2026-01-01T00:00:00Z')
// days = floor((now - created)/DAY). 한낮 오프셋을 더해 경계일 안에 안전히 위치.
const atDay = (d: number) => CREATED.getTime() + d * DAY + 6 * 3_600_000

describe('onboardingPhase — 경계', () => {
  it('알 수 없는 created → normal (보수적 X)', () => {
    assert.equal(onboardingPhase(null), 'normal')
    assert.equal(onboardingPhase(undefined), 'normal')
  })

  it('0~6일 → silent', () => {
    for (const d of [0, 1, 6]) assert.equal(onboardingPhase(CREATED, atDay(d)), 'silent')
  })

  it('7일째 정확히 → gentle_checkin (경계 포함)', () => {
    assert.equal(onboardingPhase(CREATED, atDay(7)), 'gentle_checkin')
  })

  it('7~13일 → gentle_checkin', () => {
    for (const d of [7, 8, 13]) assert.equal(onboardingPhase(CREATED, atDay(d)), 'gentle_checkin')
  })

  it('14~20일 → optional_nudge', () => {
    for (const d of [14, 15, 20]) assert.equal(onboardingPhase(CREATED, atDay(d)), 'optional_nudge')
  })

  it('21~27일 → conservative', () => {
    for (const d of [21, 22, 27]) assert.equal(onboardingPhase(CREATED, atDay(d)), 'conservative')
  })

  it('28일째부터 → normal', () => {
    for (const d of [28, 29, 100]) assert.equal(onboardingPhase(CREATED, atDay(d)), 'normal')
  })

  it('string created_at 도 동일하게 처리', () => {
    assert.equal(onboardingPhase('2026-01-01T00:00:00Z', atDay(3)), 'silent')
  })
})

describe('파생 헬퍼', () => {
  const phases: OnboardingPhase[] = [
    'silent',
    'gentle_checkin',
    'optional_nudge',
    'conservative',
    'normal',
  ]

  it('shouldShowAccuracyScore — normal/conservative 만 true', () => {
    assert.equal(shouldShowAccuracyScore('normal'), true)
    assert.equal(shouldShowAccuracyScore('conservative'), true)
    assert.equal(shouldShowAccuracyScore('silent'), false)
    assert.equal(shouldShowAccuracyScore('gentle_checkin'), false)
    assert.equal(shouldShowAccuracyScore('optional_nudge'), false)
  })

  it('recommendationSafetyFactor — conservative 만 0.95, 나머지 1.0 (핀고정)', () => {
    assert.equal(recommendationSafetyFactor('conservative'), 0.95)
    for (const p of phases.filter((p) => p !== 'conservative')) {
      assert.equal(recommendationSafetyFactor(p), 1.0)
    }
  })

  it('shouldShowProactiveNudge — silent 만 false', () => {
    assert.equal(shouldShowProactiveNudge('silent'), false)
    for (const p of phases.filter((p) => p !== 'silent')) {
      assert.equal(shouldShowProactiveNudge(p), true)
    }
  })
})
