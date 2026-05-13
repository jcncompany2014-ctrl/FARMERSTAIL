import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { STREAK_MILESTONES, computeStreak, type CheckinRow } from './streaks.ts'

function row(
  cycle: number,
  checkpoint: 'week_2' | 'week_4' = 'week_2',
): CheckinRow {
  return {
    created_at: new Date(2024, 0, cycle).toISOString(),
    cycle_number: cycle,
    checkpoint,
  }
}

describe('computeStreak', () => {
  it('empty 입력은 0 + 첫 마일스톤 nextMilestone', () => {
    const s = computeStreak([])
    assert.equal(s.totalCycles, 0)
    assert.equal(s.currentStreak, 0)
    assert.equal(s.longestStreak, 0)
    assert.deepEqual(s.nextMilestone, STREAK_MILESTONES[0])
    assert.equal(s.reachedMilestone, null)
  })

  it('단일 cycle = streak 1', () => {
    const s = computeStreak([row(1)])
    assert.equal(s.totalCycles, 1)
    assert.equal(s.currentStreak, 1)
    assert.equal(s.longestStreak, 1)
  })

  it('같은 cycle 의 week_2 + week_4 는 dedupe 되어 1 cycle', () => {
    const s = computeStreak([row(3, 'week_2'), row(3, 'week_4')])
    assert.equal(s.totalCycles, 1)
    assert.equal(s.currentStreak, 1)
  })

  it('연속 3 cycle → current 3, longest 3', () => {
    const s = computeStreak([row(1), row(2), row(3)])
    assert.equal(s.currentStreak, 3)
    assert.equal(s.longestStreak, 3)
  })

  it('끊긴 cycle → current 는 끝부터만, longest 는 전 기간', () => {
    // 1,2,3 (3연속) → gap → 7,8 (2연속). current=2, longest=3
    const s = computeStreak([row(1), row(2), row(3), row(7), row(8)])
    assert.equal(s.currentStreak, 2)
    assert.equal(s.longestStreak, 3)
  })

  it('4 cycle 도달 시 reachedMilestone set', () => {
    const s = computeStreak([row(1), row(2), row(3), row(4)])
    assert.equal(s.currentStreak, 4)
    assert.equal(s.reachedMilestone?.count, 4)
    assert.equal(s.nextMilestone?.count, 12)
  })

  it('마일스톤 사이 진행률 — 4→12 의 중간 (8 cycle) = 0.5', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1))
    const s = computeStreak(rows)
    assert.equal(s.currentStreak, 8)
    assert.equal(s.nextMilestone?.count, 12)
    assert.ok(Math.abs(s.progressToNext - 0.5) < 1e-5)
  })

  it('마지막 마일스톤 초과 시 next null, progress 1', () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(i + 1))
    const s = computeStreak(rows)
    assert.equal(s.nextMilestone, null)
    assert.equal(s.progressToNext, 1)
  })
})
