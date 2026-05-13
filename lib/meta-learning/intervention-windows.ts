/**
 * 개입 효과 윈도우 예측 — 발명 명세 6.7 (B-80).
 *
 * 능동 개입의 효과가 가장 좋은 "시점" 예측. 같은 메시지라도 아침/저녁,
 * 평일/주말, 직후/3일후 등 시점에 따라 사용자 응답률이 다르다.
 *
 * # 1차 단순 구현
 * push_log + 사용자 응답 (push 후 N시간 내 앱 진입) 시계열 분석.
 * 각 시간대 별 평균 응답률 계산 → 가장 높은 시간대를 추천.
 *
 * # PCT 핵심 — flag 가드
 * flag OFF 면 KST 09:00 (default 시간) 반환.
 */

import { isInventionEnabled } from '../invention-flags.ts'

export type InterventionTimingHint = {
  /** Asia/Seoul 시 (0~23) */
  hour: number
  /** 요일 0(일)~6(토). null = 모든 요일 동일. */
  dayOfWeek: number | null
  /** 0~1 신뢰도 (시도 횟수 / 표본 충분도). 낮으면 default hint 사용. */
  confidence: number
}

const DEFAULT_HINT: InterventionTimingHint = {
  hour: 9,
  dayOfWeek: null,
  confidence: 0,
}

/**
 * push_log 시계열 + 응답 (event_log 'app_open' 등) 분석.
 *
 * @param sentRows — push 발송 시각 array (Asia/Seoul hour, dow)
 * @param respondedRows — push 후 30분 내 app open 시각 array
 * @returns 다음 푸시 권장 시점
 */
export function predictBestTiming(
  sentRows: Array<{ hour: number; dayOfWeek: number }>,
  respondedRows: Array<{ hour: number; dayOfWeek: number }>,
): InterventionTimingHint {
  if (!isInventionEnabled('meta_learning')) return DEFAULT_HINT
  if (sentRows.length < 10) return DEFAULT_HINT // 표본 부족

  // 시간대별 응답률 = responded / sent
  const sentByHour = new Map<number, number>()
  const respByHour = new Map<number, number>()
  for (const s of sentRows) {
    sentByHour.set(s.hour, (sentByHour.get(s.hour) ?? 0) + 1)
  }
  for (const r of respondedRows) {
    respByHour.set(r.hour, (respByHour.get(r.hour) ?? 0) + 1)
  }

  let bestHour = 9
  let bestRate = 0
  for (const [hour, sent] of sentByHour) {
    if (sent < 3) continue // 표본 미달
    const responded = respByHour.get(hour) ?? 0
    const rate = responded / sent
    if (rate > bestRate) {
      bestRate = rate
      bestHour = hour
    }
  }

  // 요일별 응답률 — 가장 높은 요일이 평균보다 20%p+ 높으면 추천
  const sentByDow = new Map<number, number>()
  const respByDow = new Map<number, number>()
  for (const s of sentRows) {
    sentByDow.set(s.dayOfWeek, (sentByDow.get(s.dayOfWeek) ?? 0) + 1)
  }
  for (const r of respondedRows) {
    respByDow.set(r.dayOfWeek, (respByDow.get(r.dayOfWeek) ?? 0) + 1)
  }
  let bestDow: number | null = null
  let bestDowRate = 0
  const overallRate = respondedRows.length / sentRows.length
  for (const [dow, sent] of sentByDow) {
    if (sent < 3) continue
    const responded = respByDow.get(dow) ?? 0
    const rate = responded / sent
    if (rate > bestDowRate && rate > overallRate + 0.2) {
      bestDowRate = rate
      bestDow = dow
    }
  }

  // confidence — 표본 크기 기반
  const confidence = Math.min(1, sentRows.length / 100)

  return {
    hour: bestHour,
    dayOfWeek: bestDow,
    confidence: Math.round(confidence * 100) / 100,
  }
}

/**
 * 장기 효과 학습 목표 (B-81) — 4주/8주/12주 BCS·체중 시계열의 안정성.
 *
 * 단순 룰: 시점 N 의 BCS 가 이상(5) 으로 수렴할수록 효과 ↑.
 */
export function longTermOutcomeScore(
  bcsByWeek: Array<{ week: number; bcs: number }>,
  targetBcs: number = 5,
): number {
  if (!isInventionEnabled('meta_learning')) return 0
  if (bcsByWeek.length === 0) return 0
  // 마지막 시점의 BCS 가 targetBcs 에 가까울수록 +
  const last = bcsByWeek[bcsByWeek.length - 1]
  const distance = Math.abs(last.bcs - targetBcs)
  // 0 거리 = 1.0, 4+ 거리 = 0
  return Math.max(0, 1 - distance / 4)
}
