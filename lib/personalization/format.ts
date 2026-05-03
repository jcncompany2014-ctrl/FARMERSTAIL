/**
 * Farmer's Tail — Formula 한국어 포매터.
 *
 * `Formula` 객체를 사용자 / 운영자에게 노출할 수 있는 한국어 텍스트로 변환.
 * email / push body / admin 로그 / 디버그 등 여러 곳에서 동일 표현 유지.
 *
 * 모두 pure function — DB / 네트워크 / Date 호출 없음.
 */
import { FOOD_LINE_META, ALL_LINES } from './lines.ts'
import type { Formula, FoodLine } from './types.ts'

/**
 * 메인 라인 (가장 비중 큰) 식별 + 메타 반환. 모든 라인이 0% 면 'basic' fallback.
 */
export function mainLineOf(formula: Formula): {
  line: FoodLine
  pct: number
  name: string
  subtitle: string
} {
  let mainLine: FoodLine = 'basic'
  let max = -1
  for (const line of ALL_LINES) {
    if (formula.lineRatios[line] > max) {
      max = formula.lineRatios[line]
      mainLine = line
    }
  }
  return {
    line: mainLine,
    pct: Math.round(max * 100),
    name: FOOD_LINE_META[mainLine].name,
    subtitle: FOOD_LINE_META[mainLine].subtitle,
  }
}

/**
 * 라인 비율을 한 줄 문자열로. 0% 라인 제외, 비중 내림차순.
 *
 *   "Joint 60% / Premium 30% / Skin 10%"
 */
export function formatLineRatios(formula: Formula): string {
  return ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
    .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
    .map((l) => `${FOOD_LINE_META[l].name} ${Math.round(formula.lineRatios[l] * 100)}%`)
    .join(' / ')
}

/**
 * 토퍼 한 줄 — 야채/육류 둘 다 0 이면 빈 문자열.
 *
 *   "야채 +10%, 육류 +5%"
 */
export function formatToppers(formula: Formula): string {
  const parts: string[] = []
  if (formula.toppers.vegetable > 0) {
    parts.push(`야채 +${Math.round(formula.toppers.vegetable * 100)}%`)
  }
  if (formula.toppers.protein > 0) {
    parts.push(`육류 +${Math.round(formula.toppers.protein * 100)}%`)
  }
  return parts.join(', ')
}

/**
 * 전환 전략 → 한국어 라벨.
 */
export function transitionLabel(formula: Formula): string {
  switch (formula.transitionStrategy) {
    case 'aggressive':
      return '즉시 풀비율 적용'
    case 'gradual':
      return '2주 점진 전환'
    case 'conservative':
      return '4주 보수적 전환'
  }
}

/**
 * 1주분 / 4주분 그램 합계. dailyGrams * 7 / 28.
 */
export function totalGrams(formula: Formula, scale: '1w' | '4w' = '1w'): number {
  const days = scale === '1w' ? 7 : 28
  return formula.dailyGrams * days
}

/**
 * 전체 요약 — 한 단락. push body / email subtitle / admin 로그.
 *
 *   "Joint 60% / Premium 30% / Skin 10% · 야채 +10% · 4주 보수적 전환 · 280 kcal/일"
 */
export function formatFormulaSummary(formula: Formula): string {
  const parts = [formatLineRatios(formula)]
  const toppers = formatToppers(formula)
  if (toppers) parts.push(toppers)
  parts.push(transitionLabel(formula))
  parts.push(`${formula.dailyKcal} kcal/일`)
  return parts.join(' · ')
}

/**
 * Reasoning 의 chipLabel 들을 priority 오름차순으로 max N 개. UI 가 직접
 * formula.reasoning 을 받아 처리하는 게 더 일반적이지만, 단순한 텍스트
 * 노출용 (push body 같은 좁은 자리) 에 사용.
 *
 *   "닭 알레르기 차단 · 시니어 → Joint 가산 · BCS 6/9 → Weight ↑"
 */
export function formatReasoningSummary(
  formula: Formula,
  maxItems = 3,
): string {
  return [...formula.reasoning]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxItems)
    .map((r) => r.chipLabel)
    .join(' · ')
}
