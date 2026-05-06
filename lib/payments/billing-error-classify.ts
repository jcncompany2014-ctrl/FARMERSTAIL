/**
 * Farmer's Tail — Toss billing 에러 분류기.
 *
 * 정기배송 결제 실패 시 어떤 reason 인지에 따라 cron 의 후속 처리 분기:
 *
 *   - permanent  → 카드/billingKey 자체가 문제. retry 의미 없음.
 *                  → 즉시 paused + requires_billing_key_renewal=true.
 *                  → 사용자에게 "카드 재등록" 메일.
 *   - transient  → 한도초과 / 잔액부족 / 네트워크. 24h 후 retry.
 *                  → next_retry_at 만 +24h, count 증가 안 함.
 *   - unknown    → 분류 못한 에러. 기존 3-strike 정책 유지.
 *
 * # 출처
 * Toss 공식 에러 코드 list — https://docs.tosspayments.com/reference/error-codes
 * 정기결제 (billing) 응답에서 자주 나오는 코드만 좁혀서 매핑.
 *
 * # 분류 가이드
 * - permanent: 사용자가 카드를 다시 등록해야 풀리는 상태.
 *     EXPIRED_CARD, INVALID_CARD, INVALID_BILLING_KEY,
 *     NOT_FOUND_PAYMENT_CARD_INFO, NOT_AUTHORIZED_KEY,
 *     CARD_NOT_FOUND, INVALID_CARD_NUMBER,
 *     INVALID_CARD_EXPIRATION, INVALID_CARD_INSTALLMENT_PLAN.
 *
 * - transient: 같은 카드로 시간이 지나면 풀리는 가능성.
 *     INSUFFICIENT_FUNDS, EXCEED_LIMIT, EXCEED_LIMIT_AMOUNT,
 *     EXCEED_DAILY_PAYMENT_LIMIT, NETWORK_ERROR, TIMEOUT,
 *     PAY_PROCESS_TIMEOUT, REJECT_CARD_COMPANY (카드사가 일시 거절),
 *     PROVIDER_ERROR (카드사 API 일시 장애).
 *
 * - 그 외 → unknown.
 */

export type BillingErrorClass = 'permanent' | 'transient' | 'unknown'

/**
 * Toss 에러 코드 → 분류. 코드 없으면 'unknown'.
 *
 * 코드 비교는 대소문자 무관. Toss 가 가끔 응답 형식 (대문자/snake) 을 흔드는
 * 경우가 있어 안전하게 normalize.
 */
export function classifyBillingError(code: string | null | undefined): BillingErrorClass {
  if (!code) return 'unknown'
  const c = code.trim().toUpperCase()
  if (PERMANENT_CODES.has(c)) return 'permanent'
  if (TRANSIENT_CODES.has(c)) return 'transient'
  return 'unknown'
}

/**
 * 사용자에게 보여줄 한국어 짧은 사유. cron / 마이페이지 callout 에서 사용.
 * Toss 의 한국어 메시지가 길거나 영어로 올 수도 있어 일관된 톤으로 변환.
 */
export function describeBillingError(
  code: string | null | undefined,
): { short: string; classOf: BillingErrorClass } {
  const classOf = classifyBillingError(code)
  const c = code?.trim().toUpperCase() ?? ''
  if (classOf === 'permanent') {
    if (c.startsWith('EXPIRED')) return { short: '카드 유효기간 만료', classOf }
    if (c.includes('CARD_NUMBER') || c === 'INVALID_CARD_NUMBER')
      return { short: '카드 번호 오류', classOf }
    if (c.includes('BILLING_KEY')) return { short: '카드 인증 만료', classOf }
    return { short: '카드 정보 확인 필요', classOf }
  }
  if (classOf === 'transient') {
    if (c.includes('INSUFFICIENT')) return { short: '잔액 부족', classOf }
    if (c.includes('LIMIT')) return { short: '한도 초과', classOf }
    if (c.includes('NETWORK') || c.includes('TIMEOUT'))
      return { short: '네트워크 오류 — 잠시 후 재시도', classOf }
    return { short: '카드사 일시 거절 — 잠시 후 재시도', classOf }
  }
  return { short: '결제 처리 실패', classOf }
}

const PERMANENT_CODES = new Set<string>([
  'EXPIRED_CARD',
  'EXPIRED_CARD_NUMBER',
  'INVALID_CARD',
  'INVALID_CARD_NUMBER',
  'INVALID_CARD_EXPIRATION',
  'INVALID_CARD_INSTALLMENT_PLAN',
  'INVALID_BILLING_KEY',
  'NOT_FOUND_BILLING_KEY',
  'NOT_FOUND_PAYMENT_CARD_INFO',
  'NOT_AUTHORIZED_KEY',
  'CARD_NOT_FOUND',
  'CARD_REPORT_LOST',
  'CARD_REPORT_STOLEN',
  'CARD_BLOCKED',
  'EXCEED_NO_ACCOUNT_LIMIT',
])

const TRANSIENT_CODES = new Set<string>([
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_BALANCE',
  'EXCEED_LIMIT',
  'EXCEED_LIMIT_AMOUNT',
  'EXCEED_DAILY_PAYMENT_LIMIT',
  'EXCEED_PAYMENT_AMOUNT_LIMIT',
  'NETWORK_ERROR',
  'TIMEOUT',
  'PAY_PROCESS_TIMEOUT',
  'PAY_PROCESS_CANCELED',
  'REJECT_CARD_COMPANY',
  'REJECT_CARD_PAYMENT',
  'PROVIDER_ERROR',
  'INVALID_REQUEST_BANK_ACCOUNT_INFO',
])

/** retry 쿨다운 (transient 분류 시 next_retry_at 에 더할 시간). */
export const RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000
