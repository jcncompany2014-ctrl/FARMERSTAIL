/**
 * 재분석 trigger 5조건 — 발명 명세 6.7-(2) B-76.
 *
 * # 5 조건
 *  1. 예측 vs 실측 오차 > 10% (체중)
 *  2. 측정 도구 업그레이드 (point_ledger 'measurement_upgrade' 발생)
 *  3. 라이프 스테이지 변경 (puppy → adult, adult → senior)
 *  4. 마지막 분석 12주 (84일) 이상 경과
 *  5. 사용자 명시 요청 (별도 flag — 현재 phase 미구현)
 *
 * # 발명 핵심 — flag 가드
 * counterfactual flag OFF 면 모두 false (재분석 trigger 안 작동).
 */

export type ReanalyzeInput = {
  /** 마지막 분석 날짜 ISO */
  lastAnalysisAt: string | null
  /** 마지막 분석 시점의 권장 체중 */
  predictedWeight: number | null
  /** 가장 최근 측정 체중 */
  actualWeight: number | null
  /** 마지막 분석 후 측정 도구 업그레이드 발생 여부 */
  hadMeasurementUpgrade: boolean
  /** 마지막 분석 시점 lifestage */
  lastStage: 'puppy' | 'adult' | 'senior' | null
  /** 현재 lifestage */
  currentStage: 'puppy' | 'adult' | 'senior' | null
  /** 사용자 명시 요청 */
  userRequested: boolean
}

export type ReanalyzeReason =
  | 'weight_drift'
  | 'measurement_upgrade'
  | 'stage_change'
  | 'stale_12w'
  | 'user_request'

function flagOn(): boolean {
  if (process.env.NEXT_PUBLIC_INVENTION_CORE !== 'on') return false
  return process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL !== 'off'
}

export function shouldReanalyze(
  input: ReanalyzeInput,
  nowMs: number = Date.now(),
): { trigger: boolean; reasons: ReanalyzeReason[] } {
  if (!flagOn()) return { trigger: false, reasons: [] }

  const reasons: ReanalyzeReason[] = []

  // 1) 예측 vs 실측 오차 > 10%
  if (
    input.predictedWeight != null &&
    input.actualWeight != null &&
    input.predictedWeight > 0
  ) {
    const errPct =
      Math.abs(input.actualWeight - input.predictedWeight) /
      input.predictedWeight
    if (errPct > 0.1) reasons.push('weight_drift')
  }

  // 2) 측정 도구 업그레이드
  if (input.hadMeasurementUpgrade) {
    reasons.push('measurement_upgrade')
  }

  // 3) lifestage 변경
  if (
    input.lastStage &&
    input.currentStage &&
    input.lastStage !== input.currentStage
  ) {
    reasons.push('stage_change')
  }

  // 4) 12주 (84일) 경과
  if (input.lastAnalysisAt) {
    const days =
      (nowMs - new Date(input.lastAnalysisAt).getTime()) / 86_400_000
    if (days >= 84) reasons.push('stale_12w')
  }

  // 5) 사용자 명시 요청
  if (input.userRequested) reasons.push('user_request')

  return { trigger: reasons.length > 0, reasons }
}

export const REASON_LABEL: Record<ReanalyzeReason, string> = {
  weight_drift: '예측 vs 실측 체중 차이 10%+',
  measurement_upgrade: '측정 도구 업그레이드 발생',
  stage_change: '라이프 스테이지 변경',
  stale_12w: '마지막 분석 12주 경과',
  user_request: '사용자 직접 요청',
}
