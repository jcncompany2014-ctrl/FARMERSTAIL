/**
 * MER 신뢰구간 산출 — 발명 모듈 D 의 신뢰도 가중 출력.
 *
 * 절대값 단일 숫자가 아닌 "380~420 kcal/일" 형태로 표시해 사용자에게
 * 데이터 정밀도의 실재감을 전달. accuracyScore 가 높을수록 구간 폭 ↓,
 * 낮을수록 폭 ↑.
 *
 * # 공식
 * spread_pct = baseSpread + (1 - accuracyScore) × widenFactor
 *  · baseSpread = 0.05 (5%)  — 가장 좋은 데이터도 NRC 권장 자체에 변동
 *  · widenFactor = 0.15      — 신뢰도 0 일 때 +15% 더해져 최대 ±20%
 *
 * accuracyScore = null (D2 grace period 등 score 없을 때) → ±10% default.
 */

export type ConfidenceInterval = {
  low: number
  high: number
  /** ±N kcal 표시용 (high - center) */
  spread: number
  /** "5~10%" 표시용 (소수) */
  spreadPct: number
}

export function merConfidenceInterval(
  mer: number,
  accuracyScore: number | null,
): ConfidenceInterval {
  const base = 0.05
  const widen = 0.15
  const score =
    accuracyScore == null ? 0.7 : Math.max(0, Math.min(1, accuracyScore))
  const spreadPct = base + (1 - score) * widen
  const spread = Math.round(mer * spreadPct)
  return {
    low: Math.max(0, Math.round(mer - spread)),
    high: Math.round(mer + spread),
    spread,
    spreadPct: Math.round(spreadPct * 100) / 100,
  }
}

/**
 * 사용자 친화 라벨 — "380~420 kcal/일" 또는 "±20 kcal".
 */
export function formatRange(ci: ConfidenceInterval, unit = 'kcal'): string {
  return `${ci.low.toLocaleString()}~${ci.high.toLocaleString()} ${unit}`
}

export function formatSpread(ci: ConfidenceInterval, unit = 'kcal'): string {
  return `±${ci.spread.toLocaleString()} ${unit}`
}
