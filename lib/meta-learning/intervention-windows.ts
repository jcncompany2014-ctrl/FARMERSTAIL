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
  // [B8 fix] 표본 임계 10 → 3. 단일 사용자 데이터 부족 시 호출처가
  // cross-user cohort 합산 데이터 전달 가능. 빠른 학습 진입.
  if (sentRows.length < 3) return DEFAULT_HINT

  // 시간대별 응답률 = responded / sent
  const sentByHour = new Map<number, number>()
  const respByHour = new Map<number, number>()
  for (const s of sentRows) {
    sentByHour.set(s.hour, (sentByHour.get(s.hour) ?? 0) + 1)
  }
  for (const r of respondedRows) {
    respByHour.set(r.hour, (respByHour.get(r.hour) ?? 0) + 1)
  }

  // audit #5: 단순 rate 비교는 표본 적은 hour 의 noise 에 휘둘리고, 한 hour 에
   // 응답이 한 번이라도 들어오면 bestHour 가 거기로 lock 되며 다른 hour 가 평가
  // 자체 못 받음 (sent < 3 임계). Wilson score interval 의 하한 (95% conf) 으로
  // 비교 → 표본 큰 hour 가 신뢰도 우위, tied 시 default 9시 우선.
  //
  // Wilson lower bound for Bernoulli proportion:
  //   p̂ = k/n, z = 1.96 (95% CI), denom = 1 + z²/n
  //   p̂ + z²/(2n) − z√(p̂(1-p̂)/n + z²/(4n²))   all divided by denom
  function wilsonLower(k: number, n: number): number {
    if (n === 0) return 0
    const z = 1.96
    const z2 = z * z
    const phat = k / n
    const denom = 1 + z2 / n
    const center = phat + z2 / (2 * n)
    const margin = z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))
    return Math.max(0, (center - margin) / denom)
  }

  let bestHour = 9
  let bestScore = -Infinity
  for (const [hour, sent] of sentByHour) {
    if (sent < 3) continue // 표본 미달
    const responded = respByHour.get(hour) ?? 0
    const score = wilsonLower(responded, sent)
    // strict `>` — tied 시 default 9 와 가까운 첫 hour 유지 (결정성).
    if (score > bestScore) {
      bestScore = score
      bestHour = hour
    }
  }

  // 요일별 응답률 — 가장 높은 요일이 평균보다 20%p+ 높으면 추천.
  // audit #23: prior smoothing (Beta) — 작은 표본에서 noise 에 휘둘리는 것
  // 차단. posterior_rate = (k + α) / (n + α + β) where α=overallRate*prior_n,
  // β=(1-overallRate)*prior_n. prior_n=5 → 5 sample 가치의 prior.
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
  const overallRate =
    sentRows.length > 0 ? respondedRows.length / sentRows.length : 0
  const PRIOR_N = 5
  const alpha = overallRate * PRIOR_N
  const beta = (1 - overallRate) * PRIOR_N
  for (const [dow, sent] of sentByDow) {
    if (sent < 3) continue
    const responded = respByDow.get(dow) ?? 0
    // Beta posterior mean (prior smoothing 으로 표본 작을 때 overall 로 shrink).
    const posteriorRate = (responded + alpha) / (sent + alpha + beta)
    if (posteriorRate > bestDowRate && posteriorRate >= overallRate * 1.5) {
      bestDowRate = posteriorRate
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
  const last = bcsByWeek[bcsByWeek.length - 1]!
  const distance = Math.abs(last.bcs - targetBcs)
  // 0 거리 = 1.0, 4+ 거리 = 0
  return Math.max(0, 1 - distance / 4)
}
