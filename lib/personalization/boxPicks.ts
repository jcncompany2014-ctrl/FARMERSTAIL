/**
 * boxPicks — 박스에 담을 레시피 고르기 규칙 (AdjustSheet 의 두뇌).
 *
 * # 왜 별도 모듈인가
 * 규칙 자체는 순수한데 컴포넌트 안에 있으면 검증하려고 로그인·설문·분석을 다
 * 거쳐야 한다. 여기로 빼서 테스트로 못박는다.
 *
 * # 규칙 (사장님 2026-07-15 · boxComposition 과 동일한 제약)
 *  · 박스는 최대 2칸. 1칸이면 100%, 2칸이면 50:50.
 *  · 빈 박스는 없다 — 마지막 한 칸은 뺄 수 없다.
 *  · 2칸이 다 찼는데 새로 고르면 **먼저 담은 것**이 빠진다(막다른 길 방지).
 *  · 알레르기 차단 레시피는 담을 수 없다.
 */
import type { FoodLine } from './types.ts'

/** 박스에 담을 수 있는 최대 레시피 수. */
export const MAX_PICKS = 2

export type PickResult = {
  picks: FoodLine[]
  /** 규칙상 거절됨 — UI 는 흔들기/햅틱으로 알린다. */
  rejected: boolean
}

/**
 * 레시피 한 칸을 토글한 결과.
 * 거절되면 picks 는 그대로고 rejected=true.
 */
export function togglePick(
  prev: FoodLine[],
  line: FoodLine,
  blocked: ReadonlySet<FoodLine>,
): PickResult {
  if (blocked.has(line)) return { picks: prev, rejected: true }

  if (prev.includes(line)) {
    // 빈 박스는 존재할 수 없다 — 마지막 하나는 못 뺀다.
    if (prev.length <= 1) return { picks: prev, rejected: true }
    return { picks: prev.filter((p) => p !== line), rejected: false }
  }

  // 다 찼으면 먼저 담은 것을 밀어내고 새것을 넣는다. 막아버리면 "빼고 다시
  // 고르세요" 두 번 탭이 되는데, 2칸짜리에선 과한 요구다.
  if (prev.length >= MAX_PICKS) {
    return { picks: [...prev.slice(1), line], rejected: false }
  }
  return { picks: [...prev, line], rejected: false }
}

/** 고른 레시피 → 실제 박스 비율(0-1). 1종 100% / 2종 50:50. */
export function ratiosFromPicks(picks: FoodLine[]): Record<FoodLine, number> {
  const out: Record<FoodLine, number> = {
    basic: 0,
    weight: 0,
    skin: 0,
    premium: 0,
    joint: 0,
  }
  if (picks.length === 0) return out
  const each = 1 / picks.length
  for (const p of picks) out[p] = each
  return out
}

/** 추천과 달라졌는지 (순서는 무시 — 담긴 구성만 본다). */
export function picksChanged(
  picks: FoodLine[],
  recommended: FoodLine[],
): boolean {
  if (picks.length !== recommended.length) return true
  return picks.some((p) => !recommended.includes(p))
}
