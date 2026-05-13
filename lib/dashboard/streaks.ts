/**
 * Farmer's Tail — 체크인 스트릭 라이브러리.
 *
 * # 정의
 * - "스트릭(streak)" 은 보호자가 cycle 마다 체크인(week_2 또는 week_4) 을
 *   빠짐없이 응답한 연속 횟수.
 * - 한 cycle 안에 week_2 OR week_4 중 하나라도 응답하면 그 cycle 은 카운트됨.
 * - "현재 스트릭" 은 가장 최근 cycle 부터 거꾸로, 연속된 cycle 카운트.
 * - "최장 스트릭" 은 전체 기간 중 가장 긴 연속 cycle 카운트.
 *
 * # 마일스톤
 * - 4 cycle (≈4개월 함께 / 첫 분기 케어)
 * - 12 cycle (≈1년 함께)
 * - 24 cycle (≈2년 함께)
 * - 52 cycle (≈4년 함께 — long-term)
 *
 * # 디자인 노트
 * voice-guidelines §10 — 게이미피케이션은 보조 도구. 강요 X. 끊겨도
 * "다시 시작" 톤. "연속 N회" 같은 압박형 카피는 카드에서 부드럽게 ("N회 함께").
 *
 * # 입력 형식 (DB 모양 그대로)
 * 한 row = 한 체크인 응답. 같은 cycle 에 week_2 / week_4 가 분리된 row 로
 * 들어올 수 있어, cycle_number 로 dedupe 한 후 정렬.
 */

export type CheckinRow = {
  created_at: string
  cycle_number: number
  checkpoint: 'week_2' | 'week_4'
}

export type Milestone = {
  count: number
  /** 사용자에게 보여줄 한글 라벨 — "함께" 톤. */
  label: string
}

export const STREAK_MILESTONES: ReadonlyArray<Milestone> = [
  { count: 4, label: '4 cycle 함께 — 첫 분기' },
  { count: 12, label: '12 cycle 함께 — 한 해' },
  { count: 24, label: '24 cycle 함께 — 2년' },
  { count: 52, label: '52 cycle 함께 — long-term' },
] as const

export type StreakInfo = {
  /** 총 cycle 카운트 (cycle_number distinct). */
  totalCycles: number
  /** 가장 최근 cycle 에서 거꾸로 연속된 cycle 수. */
  currentStreak: number
  /** 전체 기간 중 최장 연속. */
  longestStreak: number
  /** 다음으로 도달할 마일스톤. null = 모두 달성. */
  nextMilestone: Milestone | null
  /** currentStreak 가 정확히 마일스톤 값일 때만 set. */
  reachedMilestone: Milestone | null
  /** nextMilestone 까지 진행률 0~1. */
  progressToNext: number
}

/**
 * 체크인 row 들로부터 스트릭 정보 계산.
 *
 * 알고리즘:
 *  1) cycle_number 별로 dedupe (week_2 / week_4 합쳐서 1개의 cycle)
 *  2) cycle_number 오름차순 정렬
 *  3) currentStreak: 마지막 cycle 부터 거꾸로, 인접 cycle 끼리 차이 1 이면 +1
 *  4) longestStreak: 같은 방식으로 sliding 최대값
 */
export function computeStreak(rows: CheckinRow[] | null | undefined): StreakInfo {
  const empty: StreakInfo = {
    totalCycles: 0,
    currentStreak: 0,
    longestStreak: 0,
    nextMilestone: STREAK_MILESTONES[0] ?? null,
    reachedMilestone: null,
    progressToNext: 0,
  }
  if (!rows || rows.length === 0) return empty

  // cycle_number distinct
  const cycles = Array.from(new Set(rows.map((r) => r.cycle_number)))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)

  if (cycles.length === 0) return empty

  // currentStreak — 가장 큰 cycle 부터 거꾸로 인접 cycle 1 차이 검사
  let current = 1
  for (let i = cycles.length - 1; i > 0; i -= 1) {
    if (cycles[i] - cycles[i - 1] === 1) {
      current += 1
    } else {
      break
    }
  }

  // longestStreak — sliding 최대
  let longest = 1
  let run = 1
  for (let i = 1; i < cycles.length; i += 1) {
    if (cycles[i] - cycles[i - 1] === 1) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  const nextMilestone =
    STREAK_MILESTONES.find((m) => m.count > current) ?? null
  const reachedMilestone =
    STREAK_MILESTONES.find((m) => m.count === current) ?? null

  // 마지막 마일스톤 이후의 진행률 — 직전 마일스톤(없으면 0) 부터 nextMilestone 까지.
  let progressToNext = 0
  if (nextMilestone) {
    const prevMilestoneCount =
      [...STREAK_MILESTONES]
        .reverse()
        .find((m) => m.count <= current)?.count ?? 0
    const span = nextMilestone.count - prevMilestoneCount
    progressToNext = span > 0 ? (current - prevMilestoneCount) / span : 0
    if (progressToNext < 0) progressToNext = 0
    if (progressToNext > 1) progressToNext = 1
  } else {
    progressToNext = 1
  }

  return {
    totalCycles: cycles.length,
    currentStreak: current,
    longestStreak: longest,
    nextMilestone,
    reachedMilestone,
    progressToNext,
  }
}
