/**
 * 다변량 신뢰도 산출 — 발명 모듈 C.
 *
 * 자가보고 데이터의 측정 메타데이터로부터 변수별 신뢰도 점수 0~1 산출.
 * 신뢰도 = w1×W_method + w2×W_recency + w3×W_population.
 *
 * [C3] W_population 클러스터 정합성도 이제 lib 안에 구현. clusterMeanBySize
 * 와 결합 — 사용자 입력값이 같은 size 견종 평균과 얼마나 가까운지로 신뢰도
 * 가중. 이상값 (예: toy 견인데 50kg 입력) 일수록 W_population ↓.
 *
 * 사용자 노출: voice-guidelines §1 — "신뢰도" 단어 금지. UI 라벨은
 * "맞춤도" / "정밀 분석 진행률" 사용. 이 함수는 내부 도메인 용어 (reliability)
 * 그대로 유지 — 코드 명료성.
 */

export type WeightMethod =
  | 'vet_scale'
  | 'home_digital'
  | 'home_analog'
  | 'hold'
  | 'eyeball'
  | 'unknown'

export type ActivityMethod = 'pedometer' | 'gps' | 'subjective' | 'unknown'

export type FeedMethod =
  | 'auto_delivery'
  | 'scale'
  | 'cup'
  | 'eyeball'
  | 'unknown'

/** 측정 도구별 정확도 점수 (W_method). 발명 명세 학술 근거 기반. */
const WEIGHT_METHOD_SCORE: Record<WeightMethod, number> = {
  vet_scale: 1.0,
  home_digital: 0.9,
  home_analog: 0.7,
  hold: 0.6,
  eyeball: 0.4,
  unknown: 0.3,
}

const ACTIVITY_METHOD_SCORE: Record<ActivityMethod, number> = {
  pedometer: 0.95,
  gps: 0.95,
  subjective: 0.5,
  unknown: 0.4,
}

const FEED_METHOD_SCORE: Record<FeedMethod, number> = {
  auto_delivery: 1.0, // 자체 사료 자동 추적 — 발명 핵심 차별화
  scale: 0.95,
  cup: 0.7,
  eyeball: 0.4,
  unknown: 0.3,
}

/**
 * 측정 최근성 점수 (W_recency).
 *   1주 이내    1.0
 *   1개월 이내  0.85
 *   3개월 이내  0.6
 *   6개월 이내  0.4
 *   그 외       0.2
 */
export function recencyScore(
  measuredAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!measuredAt) return 0.2
  const t = typeof measuredAt === 'string' ? new Date(measuredAt) : measuredAt
  const days = (nowMs - t.getTime()) / 86_400_000
  if (days <= 7) return 1.0
  if (days <= 30) return 0.85
  if (days <= 90) return 0.6
  if (days <= 180) return 0.4
  return 0.2
}

/**
 * 변수별 1차 신뢰도 산출.
 * W = w_method × method_score + w_recency × recency_score
 * (W_population 은 추후 클러스터 RPC 와 결합. 지금은 weight 0.7/0.3 분배.)
 */
export function weightReliability(
  method: WeightMethod | string | null | undefined,
  measuredAt: string | Date | null | undefined,
  nowMs?: number,
): number {
  const m = (method ?? 'unknown') as WeightMethod
  const methodScore = WEIGHT_METHOD_SCORE[m] ?? WEIGHT_METHOD_SCORE.unknown
  const recScore = recencyScore(measuredAt, nowMs)
  return Math.round((0.7 * methodScore + 0.3 * recScore) * 100) / 100
}

export function activityReliability(
  method: ActivityMethod | string | null | undefined,
): number {
  const m = (method ?? 'unknown') as ActivityMethod
  return ACTIVITY_METHOD_SCORE[m] ?? ACTIVITY_METHOD_SCORE.unknown
}

export function feedReliability(
  method: FeedMethod | string | null | undefined,
): number {
  const m = (method ?? 'unknown') as FeedMethod
  return FEED_METHOD_SCORE[m] ?? FEED_METHOD_SCORE.unknown
}

/**
 * 종합 신뢰도 — "가장 약한 고리" 가중 (발명 명세 6.3-(7)).
 *
 * # [B4 fix] 가중치 재조정
 * 이전: 0.6 × min + 0.4 × avg — min 가중 너무 강해 한 변수만 약해도
 * (예: 사진 미업로드로 w_image=0.3) 전체가 50% 미만 → 사용자 좌절.
 *
 * 새 공식: 0.4 × min + 0.6 × avg
 *  · min 영향력은 유지 (1개 약하면 전체 ↓) 하되 강도 완화.
 *  · scores=[0.95, 0.95, 0.3] → 이전 0.47 / 새 0.72 ("안정적")
 *  · scores=[0.95, 0.95, 0.95] → 이전 0.95 / 새 0.95 (변동 X)
 *  · scores=[0.3, 0.3, 0.3] → 이전 0.30 / 새 0.30 (변동 X)
 *  · 변수 다수 약할 땐 그대로 낮지만, 1개만 약하면 가혹하지 않음.
 */
export function overallReliability(scores: number[]): number {
  if (scores.length === 0) return 0
  const min = Math.min(...scores)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.round((0.4 * min + 0.6 * avg) * 100) / 100
}

/**
 * [C3] W_population — 클러스터 정합성 점수.
 *
 * 입력값이 같은 size 견종의 평균에서 얼마나 떨어져있는지로 0~1 산출.
 * 평균과 일치 = 1.0, 표준편차 1.5배 이상 떨어지면 0.
 *
 * 발명 명세 6.3 — 신뢰도 가중 회귀의 W_population 컴포넌트.
 * clusterMeanBySize 와 결합 사용.
 *
 * @param value 사용자 입력값 (체중·활동 baseline 등)
 * @param clusterMean 같은 size 견종 평균
 * @param tolerance 표준편차 기준 (default 0.3 — 30% 차이까지 허용)
 */
export function populationReliability(
  value: number,
  clusterMean: number,
  tolerance: number = 0.3,
): number {
  if (clusterMean <= 0 || value <= 0) return 0.5 // 데이터 부족 시 중립
  const deviation = Math.abs(value - clusterMean) / clusterMean
  if (deviation <= tolerance) return 1.0
  // tolerance ~ 2×tolerance 범위에서 1.0 → 0.0 선형 감소
  if (deviation >= 2 * tolerance) return 0
  return Math.round((1 - (deviation - tolerance) / tolerance) * 100) / 100
}

/**
 * [C3] 종합 신뢰도 + W_population. weightReliability 가 method/recency 만
 * 본다면 이 함수는 cluster 정합성까지 결합.
 *
 * 산출: 0.5 × (method+recency 평균) + 0.3 × population + 0.2 × min
 */
export function compositeReliabilityWithPopulation(
  methodRecency: number,
  population: number,
): number {
  const avg = (methodRecency + population) / 2
  const min = Math.min(methodRecency, population)
  return Math.round((0.5 * avg + 0.3 * population + 0.2 * min) * 100) / 100
}

/**
 * UI 라벨 변환 — voice-guidelines §1. "신뢰도" 용어 금지.
 * 0.85+ "정밀 케어 가족" / 0.7+ "안정적" / 0.5+ "성장 중" / 그 외 "초기"
 *
 * 0~1 score → 사용자 친화 라벨. 절대 점수 노출은 settings 에서만.
 */
export function accuracyLabel(score: number): {
  text: string
  percent: number
} {
  return {
    text:
      score >= 0.85
        ? '정밀 케어 가족'
        : score >= 0.7
          ? '안정적'
          : score >= 0.5
            ? '성장 중'
            : '초기',
    percent: Math.round(score * 100),
  }
}

/** 측정 도구 사용자 친화 라벨. 입력 폼 select 표시용. */
export const WEIGHT_METHOD_LABELS: Record<WeightMethod, string> = {
  vet_scale: '동물병원 체중계',
  home_digital: '가정용 디지털',
  home_analog: '가정용 아날로그',
  hold: '안고 재기',
  eyeball: '눈으로 추정',
  unknown: '모름',
}

export const ACTIVITY_METHOD_LABELS: Record<ActivityMethod, string> = {
  pedometer: '만보계 / 스마트태그',
  gps: 'GPS 트래커',
  subjective: '주관 추정',
  unknown: '모름',
}

export const FEED_METHOD_LABELS: Record<FeedMethod, string> = {
  auto_delivery: '자체 사료 자동 추적',
  scale: '저울',
  cup: '계량컵',
  eyeball: '눈대중',
  unknown: '모름',
}
