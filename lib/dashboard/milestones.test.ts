import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  currentMilestone,
  renderMilestoneMessage,
  computeCareLabel,
} from './milestones.ts'

const NOW = new Date('2026-05-13T00:00:00Z').getTime()

describe('currentMilestone', () => {
  it('가입 30일 도달 → 한 달 milestone', () => {
    const joined = new Date(NOW - 30 * 86_400_000).toISOString()
    const m = currentMilestone(joined, NOW)
    assert.ok(m)
    assert.equal(m!.daysSince, 30)
  })

  it('가입 100일 도달 → 100일 milestone', () => {
    const joined = new Date(NOW - 100 * 86_400_000).toISOString()
    const m = currentMilestone(joined, NOW)
    assert.equal(m?.daysSince, 100)
  })

  it('7일 윈도우 넘어서 → null', () => {
    const joined = new Date(NOW - 38 * 86_400_000).toISOString()
    const m = currentMilestone(joined, NOW)
    assert.equal(m, null)
  })

  it('null 입력 → null', () => {
    assert.equal(currentMilestone(null, NOW), null)
  })

  it('가입 365일 → 1년 milestone', () => {
    const joined = new Date(NOW - 365 * 86_400_000).toISOString()
    const m = currentMilestone(joined, NOW)
    assert.equal(m?.daysSince, 365)
  })
})

describe('renderMilestoneMessage', () => {
  it('{name} 치환', () => {
    const m = currentMilestone(new Date(NOW - 30 * 86_400_000).toISOString(), NOW)!
    const msg = renderMilestoneMessage(m, '초롱이')
    assert.match(msg, /초롱이/)
    assert.doesNotMatch(msg, /\{name\}/)
  })

  it('dogName null → "우리 아이" fallback', () => {
    const m = currentMilestone(new Date(NOW - 30 * 86_400_000).toISOString(), NOW)!
    const msg = renderMilestoneMessage(m, null)
    assert.match(msg, /우리 아이/)
  })
})

describe('computeCareLabel', () => {
  it('0.85+ → precise_care_family', () => {
    assert.equal(computeCareLabel(0.9), 'precise_care_family')
    assert.equal(computeCareLabel(0.85), 'precise_care_family')
  })

  it('< 0.85 → null', () => {
    assert.equal(computeCareLabel(0.84), null)
    assert.equal(computeCareLabel(0.5), null)
  })

  it('null 입력 → null', () => {
    assert.equal(computeCareLabel(null), null)
  })
})
