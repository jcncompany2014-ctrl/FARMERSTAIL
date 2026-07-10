/**
 * 견 변화 자연어 요약 (사용자 A-31).
 *
 * 시계열 분석 history 를 받아 "4주 전보다 안정적이에요" 같은 부드러운
 * 자연어 1줄 요약 생성. dashboard 또는 analysis 페이지에서 시각화 옆에 표시.
 *
 * voice-guidelines §2 — 견 주어 + 긍정 톤. 부정 변화는 "함께 살펴봐도
 * 좋아요" 같은 부드러운 표현.
 */

import { petName } from '../korean.ts'

export type HistoryPoint = {
  /** YYYY-MM-DD */
  date: string
  bcs: number | null
  weight: number | null
}

export type Narrative = {
  text: string
  /** 톤 — UI 색상 결정용 */
  tone: 'positive' | 'neutral' | 'cautious'
}

/**
 * 가장 최근 vs 그 이전 데이터 비교해 한 줄 narrative 생성.
 * 데이터 부족 (< 2 points) → null.
 */
export function summarizeHistory(
  points: HistoryPoint[],
  dogName: string | null = null,
): Narrative | null {
  if (points.length < 2) return null

  // 가장 최근 + 가장 오래된 비교
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  // audit #78: noUncheckedIndexedAccess — sorted[0] / sorted[N-1] 가 undefined
  // 가능. 위에서 points.length 가드 있지만 TS 가 못 따라감 → non-null 보장.
  const oldest = sorted[0]!
  const latest = sorted[sorted.length - 1]!

  const name = petName(dogName?.trim() || '') || '강아지'

  const weightDelta =
    oldest.weight != null && latest.weight != null
      ? Math.round((latest.weight - oldest.weight) * 100) / 100
      : null
  const bcsDelta =
    oldest.bcs != null && latest.bcs != null
      ? latest.bcs - oldest.bcs
      : null

  const weeksSpan = Math.max(
    1,
    Math.round(
      (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) /
        (7 * 86_400_000),
    ),
  )

  // BCS 변화 우선 — 체형이 더 의미 있는 신호
  if (bcsDelta != null && Math.abs(bcsDelta) >= 1) {
    if (bcsDelta < 0) {
      // BCS 감소 — 체형 개선 (이전이 BCS 높음)
      if ((oldest.bcs ?? 5) >= 7) {
        return {
          text: `${name}의 체형이 ${weeksSpan}주 전보다 조금 더 이상에 가까워졌어요`,
          tone: 'positive',
        }
      }
      return {
        text: `${name}의 체형이 약간 변했어요. 식단과 함께 살펴봐도 좋아요`,
        tone: 'cautious',
      }
    }
    if (bcsDelta > 0) {
      if ((oldest.bcs ?? 5) <= 3) {
        return {
          text: `${name}의 체형이 ${weeksSpan}주 전보다 건강한 방향으로 돌아가고 있어요`,
          tone: 'positive',
        }
      }
      return {
        text: `${name}의 체형이 약간 변했어요. 활동량을 같이 살펴봐도 좋아요`,
        tone: 'cautious',
      }
    }
  }

  // 체중 변화
  if (weightDelta != null && Math.abs(weightDelta) >= 0.1) {
    const sign = weightDelta > 0 ? '+' : '-'
    const abs = Math.abs(weightDelta).toFixed(1)
    if (Math.abs(weightDelta) < 0.5) {
      return {
        text: `${name}의 체중이 ${weeksSpan}주 동안 ${sign}${abs} kg — 안정적이에요`,
        tone: 'positive',
      }
    }
    return {
      text: `${name}의 체중이 ${weeksSpan}주 동안 ${sign}${abs} kg 변했어요`,
      tone: 'neutral',
    }
  }

  return {
    text: `${name}의 ${weeksSpan}주 동안 변화가 안정적이에요`,
    tone: 'positive',
  }
}
