import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeNextAction } from './next-action.ts'

describe('computeNextAction', () => {
  it('returns onboarding when no dogs', () => {
    const r = computeNextAction({ hasDogs: false })
    assert.equal(r?.type, 'onboarding')
    assert.equal(r?.tone, 'terracotta')
  })

  it('prioritizes analyze over weigh-in', () => {
    const r = computeNextAction({
      hasDogs: true,
      unanalyzedDog: { id: 'd1', name: '뽀삐' },
      staleWeightDog: { id: 'd1', name: '뽀삐', daysSinceLastWeight: 30 },
    })
    assert.equal(r?.type, 'analyze')
  })

  it('prioritizes approve over delivery and weigh-in', () => {
    const r = computeNextAction({
      hasDogs: true,
      pendingFormula: { dogId: 'd1', dogName: '뽀삐', formulaId: 'f1' },
      staleWeightDog: { id: 'd1', name: '뽀삐', daysSinceLastWeight: 30 },
      upcomingDelivery: { daysUntil: 1, productLabel: '소고기 1팩' },
    })
    assert.equal(r?.type, 'approve')
    assert.match(r?.href ?? '', /formulaId=f1/)
  })

  it('shows weigh-in when only stale weight', () => {
    const r = computeNextAction({
      hasDogs: true,
      staleWeightDog: { id: 'd1', name: '뽀삐', daysSinceLastWeight: 21 },
    })
    assert.equal(r?.type, 'weigh-in')
    assert.match(r?.subtitle ?? '', /21일/)
  })

  it('prioritizes checkin over weigh-in and delivery', () => {
    const r = computeNextAction({
      hasDogs: true,
      firstCheckinDog: { id: 'd1', name: '뽀삐' },
      staleWeightDog: { id: 'd1', name: '뽀삐', daysSinceLastWeight: 30 },
      upcomingDelivery: { daysUntil: 1, productLabel: '소고기 1팩' },
    })
    assert.equal(r?.type, 'checkin')
    assert.equal(r?.tone, 'moss')
    assert.match(r?.href ?? '', /\/dogs\/d1\/first-checkin/)
  })

  it('approve beats checkin', () => {
    const r = computeNextAction({
      hasDogs: true,
      pendingFormula: { dogId: 'd1', dogName: '뽀삐', formulaId: 'f1' },
      firstCheckinDog: { id: 'd1', name: '뽀삐' },
    })
    assert.equal(r?.type, 'approve')
  })

  it('skips delivery when daysUntil > 3', () => {
    const r = computeNextAction({
      hasDogs: true,
      upcomingDelivery: { daysUntil: 7, productLabel: '소고기 1팩' },
    })
    assert.equal(r, null)
  })

  it('shows delivery for D-3 or sooner', () => {
    const r = computeNextAction({
      hasDogs: true,
      upcomingDelivery: { daysUntil: 0, productLabel: '소고기 1팩' },
    })
    assert.equal(r?.type, 'delivery')
    assert.match(r?.title ?? '', /오늘/)
  })

  it('falls back to subscribe when analysis done but no sub', () => {
    const r = computeNextAction({
      hasDogs: true,
      noSubDogId: 'd1',
    })
    assert.equal(r?.type, 'subscribe')
  })

  it('returns null when everything is fine', () => {
    const r = computeNextAction({ hasDogs: true })
    assert.equal(r, null)
  })
})
