import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  STREAK_MILESTONES,
  computeStreak,
  computeDailyStreak,
  kstDayKeyFromTs,
  type CheckinRow,
} from './streaks.ts'

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

// ── 일별 기록 스트릭 (2026-07-17) ─────────────────────────────────────────

// 고정 기준 시각: 2026-07-17 (금) 12:00 KST = 2026-07-17T03:00:00Z.
// KST 정오라 UTC 변환해도 같은 날짜 — 자정 경계 흔들림 없이 안정적인 픽스처.
const NOW_MS = Date.parse('2026-07-17T03:00:00Z')
const DAY = 86_400_000
/** NOW 기준 n일 전의 KST 날짜 키. */
function kstAgo(n: number): string {
  return new Date(NOW_MS + 9 * 3600 * 1000 - n * DAY).toISOString().slice(0, 10)
}

describe('kstDayKeyFromTs', () => {
  it('UTC 오후 → +9h 로 다음날 KST 로 넘어감', () => {
    // 2026-07-16T20:00Z = 2026-07-17T05:00 KST → '2026-07-17'
    assert.equal(kstDayKeyFromTs('2026-07-16T20:00:00Z'), '2026-07-17')
  })
  it('UTC 오전은 같은 날 KST', () => {
    // 2026-07-17T01:00Z = 2026-07-17T10:00 KST → '2026-07-17'
    assert.equal(kstDayKeyFromTs('2026-07-17T01:00:00Z'), '2026-07-17')
  })
})

describe('computeDailyStreak', () => {
  it('빈 Set = 0', () => {
    assert.equal(computeDailyStreak(new Set(), NOW_MS), 0)
  })

  it('오늘만 기록 = 1', () => {
    assert.equal(computeDailyStreak(new Set([kstAgo(0)]), NOW_MS), 1)
  })

  it('오늘·어제·그제 연속 = 3', () => {
    const set = new Set([kstAgo(0), kstAgo(1), kstAgo(2)])
    assert.equal(computeDailyStreak(set, NOW_MS), 3)
  })

  it('오늘 없지만 어제 있으면 유지(진행중) — 어제부터 카운트', () => {
    // 오늘 아직 기록 전. 어제·그제 연속 → streak 2 (끊긴 것 아님).
    const set = new Set([kstAgo(1), kstAgo(2)])
    assert.equal(computeDailyStreak(set, NOW_MS), 2)
  })

  it('오늘·어제 둘 다 없으면 0 (끊김)', () => {
    const set = new Set([kstAgo(2), kstAgo(3)])
    assert.equal(computeDailyStreak(set, NOW_MS), 0)
  })

  it('중간 빈 날이 있으면 그 앞에서 멈춤', () => {
    // 오늘·어제 연속, 그제(2일전)는 없음 → streak 2.
    const set = new Set([kstAgo(0), kstAgo(1), kstAgo(3), kstAgo(4)])
    assert.equal(computeDailyStreak(set, NOW_MS), 2)
  })

  it('하루 한 번이면 충분 — 중복 날짜여도 Set 이라 1일로 카운트', () => {
    // 같은 날 식사+산책+체중 3건이 들어와도 Set 에는 1개 → 하루로 처리.
    const set = new Set([kstAgo(0)])
    set.add(kstAgo(0)) // 중복 add — 여전히 size 1
    assert.equal(computeDailyStreak(set, NOW_MS), 1)
  })
})
