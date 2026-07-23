/**
 * XL-4 (#13) — 개입 윈도우 예측 (출원서 모듈 G).
 *
 * 체중·BCS 시계열로부터 위험 도달 ETA 예측. "지금 식단 안 바꾸면
 * N일 후 BCS 6.8 도달" 같은 조기 경보.
 *
 * # 모델
 *  1. 최근 12개월 weight_logs 에서 linear regression slope (kg/day) 추출.
 *  2. 현재 BCS + 추세에서 위험 BCS 도달 ETA 계산.
 *  3. ETA < 30일이면 "즉시 개입" / 30~90일이면 "관찰 권장" / 90+ "안전".
 *
 * # 위험 BCS 정의
 *  - 비만 방향: BCS ≥ 7
 *  - 저체중 방향: BCS ≤ 3
 *
 * # 모듈 F 와의 관계
 *  F (반사실) = "만약 식단 바꾸면?" → 사용자 선택 시뮬레이션
 *  G (개입 윈도우) = "지금 그대로면 언제 위험해질까?" → 자동 알림
 *
 *  G 가 위험 시그널 감지 → F 로 시나리오 제시.
 *
 * # 알고리즘 (단순화)
 *  - n ≥ 3 measurements 필요. 부족하면 'insufficient_data' return.
 *  - 최소제곱법 linear fit: slope (kg/day), intercept (kg).
 *  - 신뢰도 (R²) 가 0.3 미만이면 trend 불명확 → 'noisy'.
 */

export interface WeightPoint {
  /** Unix ms or ISO. Internal에선 Date 로. */
  date: Date | string
  weightKg: number
}

export interface InterventionWindowInput {
  weightLogs: WeightPoint[]
  /** 현재 BCS (1-9) — survey 또는 analysis */
  currentBcs: number
  /** 현재 체중 kg (dogs.weight) */
  currentWeightKg: number
  /** 이상 체중 추정 (kg). 없으면 currentWeightKg 의 ±0% 사용. */
  idealWeightKg?: number | null
}

export type WindowVerdict =
  | 'urgent' // ETA ≤ 30일 — 즉시 개입
  | 'watch' // 30 ~ 90일
  | 'safe' // 90+ 또는 정상
  | 'insufficient_data' // n<3
  | 'noisy' // R² < 0.3

export interface InterventionWindow {
  verdict: WindowVerdict
  /** 비만 방향 위험 ETA (일). null = 도달 안함 또는 N/A */
  obesityEtaDays: number | null
  /** 저체중 방향 위험 ETA (일). */
  underweightEtaDays: number | null
  /** 추세 (kg/day). +면 증가, -면 감소 */
  weightSlopeKgPerDay: number
  /** R² (0~1) — 추세 신뢰도 */
  rSquared: number
  /** 한 문장 사용자 안내 */
  userMessage: string
}

export function evaluateInterventionWindow(
  input: InterventionWindowInput,
): InterventionWindow {
  // 정규화 — Date 로 변환 + 정렬
  const points = input.weightLogs
    .map((p) => ({
      t: typeof p.date === 'string' ? new Date(p.date).getTime() : p.date.getTime(),
      w: p.weightKg,
    }))
    .filter((p) => !Number.isNaN(p.t) && p.w > 0)
    .sort((a, b) => a.t - b.t)

  if (points.length < 3) {
    return {
      verdict: 'insufficient_data',
      obesityEtaDays: null,
      underweightEtaDays: null,
      weightSlopeKgPerDay: 0,
      rSquared: 0,
      userMessage: '체중 기록 3회 이상 필요해요.',
    }
  }

  // X 축 — 첫 측정일 기준 day (수치 안정성)
  const t0 = points[0]!.t
  const xs = points.map((p) => (p.t - t0) / 86_400_000)
  const ys = points.map((p) => p.w)

  // 최소제곱법
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY)
    den += (xs[i]! - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX

  // R²
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const predY = intercept + slope * xs[i]!
    ssTot += (ys[i]! - meanY) ** 2
    ssRes += (ys[i]! - predY) ** 2
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  if (rSquared < 0.3) {
    return {
      verdict: 'noisy',
      obesityEtaDays: null,
      underweightEtaDays: null,
      weightSlopeKgPerDay: slope,
      rSquared,
      userMessage: '체중 변화가 들쭉날쭉해서 추세 예측이 어려워요. 일관성 있게 측정해 주세요.',
    }
  }

  // 위험 체중 정의 — BCS 5 = current weight 가정, BCS 7 ≈ +15%, BCS 3 ≈ -15%.
  // 더 정확하게는 ideal weight 로 환산해야 하나 단순화.
  const ideal = input.idealWeightKg ?? input.currentWeightKg
  const obesityWeight = ideal * 1.15
  const underweightWeight = ideal * 0.85

  // ETA = (target - currentWeight) / slope (slope=kg/day)
  let obesityEtaDays: number | null = null
  let underweightEtaDays: number | null = null

  if (slope > 0.001) {
    // 증가 추세 — 비만 위험. days<=0 = 이미 과체중 구간을 넘었는데도 계속 증가 중
    // → ETA 0(즉시 경보). 예전엔 null 로 떨어져 '가장 경보가 필요한 개'가 safe 로
    // 분류돼 카드가 안 떴다(2026-07-17 수정).
    const days = (obesityWeight - input.currentWeightKg) / slope
    obesityEtaDays = days > 0 ? Math.round(days) : 0
  } else if (slope < -0.001) {
    // 감소 추세 — 저체중 위험. days<=0 = 이미 저체중 구간 아래인데 계속 감소 → ETA 0.
    const days = (input.currentWeightKg - underweightWeight) / -slope
    underweightEtaDays = days > 0 ? Math.round(days) : 0
  }

  // Verdict
  const earliestEta =
    obesityEtaDays != null && underweightEtaDays != null
      ? Math.min(obesityEtaDays, underweightEtaDays)
      : obesityEtaDays ?? underweightEtaDays
  let verdict: WindowVerdict = 'safe'
  if (earliestEta != null) {
    if (earliestEta <= 30) verdict = 'urgent'
    else if (earliestEta <= 90) verdict = 'watch'
  }

  // 사용자 메시지
  let userMessage = ''
  if (verdict === 'urgent') {
    if (obesityEtaDays != null && obesityEtaDays <= 30) {
      userMessage =
        obesityEtaDays === 0
          ? '이미 과체중이고 체중이 계속 늘고 있어요. 식단을 한 번 점검해보면 좋아요.'
          : `지금 추세라면 약 ${obesityEtaDays}일 뒤 과체중에 접어들 수 있어요. 식단을 한 번 점검해보면 좋아요.`
    } else {
      userMessage =
        underweightEtaDays === 0
          ? '이미 저체중이고 체중이 계속 줄고 있어요. 영양을 조금 보강해주면 좋아요.'
          : `지금 추세라면 약 ${underweightEtaDays}일 뒤 저체중에 접어들 수 있어요. 영양을 조금 보강해주면 좋아요.`
    }
  } else if (verdict === 'watch') {
    userMessage =
      slope > 0
        ? `완만한 증가 추세 (${(slope * 30).toFixed(2)} kg/월). 관찰 권장.`
        : `완만한 감소 추세 (${(slope * 30).toFixed(2)} kg/월). 관찰 권장.`
  } else if (verdict === 'safe') {
    userMessage =
      Math.abs(slope) < 0.001
        ? '체중이 안정적으로 유지되고 있어요.'
        : '추세는 있으나 위험 도달까지 90일 이상 — 안전합니다.'
  }

  return {
    verdict,
    obesityEtaDays,
    underweightEtaDays,
    weightSlopeKgPerDay: Math.round(slope * 10000) / 10000,
    rSquared: Math.round(rSquared * 100) / 100,
    userMessage,
  }
}
