import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { shouldReanalyze } from './reanalyze-triggers.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL
})

const NOW = new Date('2026-05-13T00:00:00Z').getTime()

const base = {
  lastAnalysisAt: new Date(NOW - 30 * 86_400_000).toISOString(),
  predictedWeight: 5,
  actualWeight: 5,
  hadMeasurementUpgrade: false,
  lastStage: 'adult' as const,
  currentStage: 'adult' as const,
  userRequested: false,
}

describe('shouldReanalyze', () => {
  it('모두 정상 → trigger false', () => {
    const r = shouldReanalyze(base, NOW)
    assert.equal(r.trigger, false)
  })

  it('체중 10%+ drift → weight_drift', () => {
    const r = shouldReanalyze({ ...base, actualWeight: 6 }, NOW)
    assert.ok(r.trigger)
    assert.ok(r.reasons.includes('weight_drift'))
  })

  it('측정 도구 업그레이드', () => {
    const r = shouldReanalyze({ ...base, hadMeasurementUpgrade: true }, NOW)
    assert.ok(r.reasons.includes('measurement_upgrade'))
  })

  it('lifestage 변경 (puppy→adult)', () => {
    const r = shouldReanalyze(
      { ...base, lastStage: 'puppy', currentStage: 'adult' },
      NOW,
    )
    assert.ok(r.reasons.includes('stage_change'))
  })

  it('12주+ 경과', () => {
    const r = shouldReanalyze(
      {
        ...base,
        lastAnalysisAt: new Date(NOW - 100 * 86_400_000).toISOString(),
      },
      NOW,
    )
    assert.ok(r.reasons.includes('stale_12w'))
  })

  it('사용자 요청', () => {
    const r = shouldReanalyze({ ...base, userRequested: true }, NOW)
    assert.ok(r.reasons.includes('user_request'))
  })

  it('여러 조건 동시', () => {
    const r = shouldReanalyze(
      {
        ...base,
        actualWeight: 6,
        hadMeasurementUpgrade: true,
      },
      NOW,
    )
    assert.equal(r.reasons.length, 2)
  })

  it('flag OFF → trigger false', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    const r = shouldReanalyze({ ...base, actualWeight: 6 }, NOW)
    assert.equal(r.trigger, false)
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL = 'on'
  })
})
