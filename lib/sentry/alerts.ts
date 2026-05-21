/**
 * Round G2 (2026-05-20): Sentry 비즈니스 알람 룰 — 강화된 헬퍼.
 *
 * 위변조 / NSH / refund queue / amount mismatch 등 운영 critical 이벤트를
 * 표준화된 fingerprint + tag 로 발사. Sentry 콘솔의 알람 룰 + Slack webhook
 * 라우팅에 사용.
 *
 * # 알람 룰 매핑 (Sentry 콘솔에서 설정)
 *   business.alert.kind = 'fraud'             → #critical-fraud Slack
 *   business.alert.kind = 'nsh_risk'          → #critical-safety Slack
 *   business.alert.kind = 'refund_failure'    → #critical-payment Slack
 *   business.alert.kind = 'amount_mismatch'   → #critical-payment Slack
 *   business.alert.kind = 'quality_breach'    → #critical-quality Slack
 *   business.alert.kind = 'pii_leak'          → #critical-privacy Slack
 *
 * # 사용
 *   alertFraud({ orderId, reason }) — 결제 위변조 감지
 *   alertNshRisk({ dogId, ratio }) — Ca:P 위험 입력
 *   alertRefundFailure({ orderId, attempts }) — Toss 환불 5회 실패
 *   alertAmountMismatch({ orderId, expected, actual }) — 결제 금액 불일치
 *
 * # 가이드
 *   PII (이메일/이름/주소/전화) 는 절대 attribute 에 넣지 말 것.
 *   ID / 카운트 / 메시지 라벨 정도만.
 */

import * as Sentry from '@sentry/nextjs'

export type AlertKind =
  | 'fraud'
  | 'nsh_risk'
  | 'refund_failure'
  | 'amount_mismatch'
  | 'quality_breach'
  | 'pii_leak'

interface BaseContext {
  /** dedupe — 같은 이벤트는 같은 issue 로 묶임 */
  fingerprintKey?: string
}

function emit(
  kind: AlertKind,
  level: 'warning' | 'error' | 'fatal',
  message: string,
  context: Record<string, string | number | boolean | null | undefined>,
  options: BaseContext = {},
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level)
    scope.setTag('business.alert.kind', kind)
    scope.setTag('business.alert.severity', level)
    scope.setExtras(context)
    if (options.fingerprintKey) {
      scope.setFingerprint(['business-alert', kind, options.fingerprintKey])
    } else {
      scope.setFingerprint(['business-alert', kind])
    }
    Sentry.captureMessage(message, level)
  })
}

/**
 * 결제 위변조 감지 — Toss webhook signature mismatch, replay attack 등.
 * fatal — 즉시 Slack 알람.
 */
export function alertFraud(params: {
  orderId: string
  reason: string
  ipHash?: string
}) {
  emit(
    'fraud',
    'fatal',
    `결제 위변조 의심: ${params.reason}`,
    {
      order_id: params.orderId,
      reason: params.reason,
      ip_hash: params.ipHash ?? null,
    },
    { fingerprintKey: `${params.reason}:${params.orderId}` },
  )
}

/**
 * NSH (Ca:P < 1.0) 위험 입력 — 사용자 raw 입력이 위험 범위.
 * warning — 사용자에게 UI 경고 동시에 운영 통계 누적.
 */
export function alertNshRisk(params: {
  dogId?: string | null
  ratio: number
  totalCaMg: number
  totalPMg: number
  isPuppy?: boolean
}) {
  emit(
    'nsh_risk',
    'warning',
    `Raw Ca:P ${params.ratio.toFixed(2)} — NSH 위험 감지`,
    {
      dog_id: params.dogId ?? null,
      ratio: params.ratio,
      total_ca_mg: params.totalCaMg,
      total_p_mg: params.totalPMg,
      is_puppy: params.isPuppy ?? false,
    },
    { fingerprintKey: params.isPuppy ? 'puppy' : 'adult' },
  )
}

/**
 * Refund queue 5회 실패 — Toss cancel 영구 실패. 수동 개입 필요.
 * error — Sentry issue.
 */
export function alertRefundFailure(params: {
  orderId: string
  attempts: number
  lastError: string
}) {
  emit(
    'refund_failure',
    'error',
    `환불 ${params.attempts}회 실패 → permanently_failed`,
    {
      order_id: params.orderId,
      attempts: params.attempts,
      last_error: params.lastError,
    },
    { fingerprintKey: params.orderId },
  )
}

/**
 * 결제 금액 불일치 — 클라이언트 amount 와 서버 amount 가 다름.
 * fatal — Toss confirm 호출 전 차단 + 즉시 알람.
 */
export function alertAmountMismatch(params: {
  orderId: string
  expected: number
  actual: number
}) {
  emit(
    'amount_mismatch',
    'fatal',
    `결제 금액 불일치: expected=${params.expected} actual=${params.actual}`,
    {
      order_id: params.orderId,
      expected: params.expected,
      actual: params.actual,
      diff: params.actual - params.expected,
    },
    { fingerprintKey: params.orderId },
  )
}

/**
 * 품질 가드 breach — 위 4개 외 안전 가드가 깨진 경우.
 * 예: stock 음수, points 음수 잔액, schema 위반 row.
 */
export function alertQualityBreach(params: {
  kind: string
  ref?: string
  detail?: string
}) {
  emit(
    'quality_breach',
    'error',
    `Quality breach: ${params.kind}`,
    {
      kind: params.kind,
      ref: params.ref ?? null,
      detail: params.detail ?? null,
    },
    { fingerprintKey: `${params.kind}:${params.ref ?? '_'}` },
  )
}

/**
 * PII leak 의심 — 로그에 email / phone / address 가 포함된 경우.
 * fatal — privacy critical.
 */
export function alertPiiLeak(params: {
  surface: string
  field: string
  ref?: string
}) {
  emit(
    'pii_leak',
    'fatal',
    `PII leak 의심: ${params.surface}.${params.field}`,
    {
      surface: params.surface,
      field: params.field,
      ref: params.ref ?? null,
    },
    { fingerprintKey: `${params.surface}:${params.field}` },
  )
}
