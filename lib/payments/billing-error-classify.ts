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

/**
 * "토스가 **확실히 거절**했다"(= 돈이 절대 안 나갔다)고 단정할 수 있는 코드
 * (2026-07-29 최종감사 #2).
 *
 * # 왜 필요한가 — 멱등키 딜레마
 * 자동결제 멱등키는 주기(next_delivery_date) 기준으로 고정된다. 그래야
 * 타임아웃(돈이 나갔는지 모름) 후 재시도가 같은 키로 원결제 결과를 돌려받아
 * **이중청구가 없다.** 그런데 토스는 멱등키 응답을 15일간 저장해 재생하므로,
 * 첫 시도가 **잔액부족 같은 확정 거절**이었으면 고객이 잔액을 채워도
 * 같은 키의 재시도는 저장된 거절만 돌려받는다 — 결제가 15일간 조용히 멈춘다.
 *
 * # 해법
 * 직전 실패가 이 목록(확정 거절 = 돈 안 나감이 보장)이면 재시도에 **새 키**를
 * 써도 이중청구 위험이 0 이다. 반대로 타임아웃·네트워크류(결과 불명)는 원래대로
 * 같은 키를 유지한다 — 안전(이중청구 방지)이 회복(재시도 성공)보다 우선.
 *
 * PAY_PROCESS_TIMEOUT / NETWORK_ERROR / TIMEOUT / PROVIDER_ERROR / null 은
 * **절대 여기 넣지 말 것** — 돈이 나갔을 수 있다.
 */
const DEFINITIVE_DECLINE_CODES = new Set<string>([
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_BALANCE',
  'EXCEED_LIMIT',
  'EXCEED_LIMIT_AMOUNT',
  'EXCEED_DAILY_PAYMENT_LIMIT',
  'EXCEED_PAYMENT_AMOUNT_LIMIT',
  'REJECT_CARD_COMPANY',
  'REJECT_CARD_PAYMENT',
])

/** 직전 실패 코드가 확정 거절인가 — 재시도에 새 멱등키를 써도 안전한가. */
export function isDefinitiveDecline(code: string | null | undefined): boolean {
  if (!code) return false
  return DEFINITIVE_DECLINE_CODES.has(code.toUpperCase())
}

/**
 * 청구 멱등키의 재시도 접미사.
 *
 * # 왜 필요한가
 * 토스는 멱등키 응답을 15일 저장·재생한다. 그래서 키 하나로 고정하면 잔액부족
 * 같은 **확정 거절**이 저장돼 고객이 잔액을 채워도 15일간 결제가 멈춘다.
 * 반대로 매번 새 키를 쓰면 타임아웃(카드는 긁혔는데 응답 유실) 재시도가
 * 새 청구가 되어 **이중청구**다.
 *
 * # 앵커를 날짜로 두면 안 되는 이유 (2026-08-05 감사)
 * `:r{오늘날짜}` 는 **키가 되돌아간다**. 확정거절 → (새 키로) 타임아웃 →
 * 다음 날 직전 코드가 비확정이라 접미사가 빠지며 **원래 키로 복귀** → 그
 * 다음 확정거절에서 또 새 날짜 키 → 두 번째 캡처.
 *
 * `failed_charge_count` 는 확정거절·unknown 에만 오르고 **transient(타임아웃류)
 * 에는 안 오른다**(subscription-charge 실패 분기 — ★2026-08-11 정합 수정: 이
 * 문장이 주장만 하고 코드는 확정거절을 transient 로 묶어 count 를 안 올리고
 * 있었다. 그 결과 접미사가 :r0 에 고정 → 2회째 거절부터 토스가 저장된 거절을
 * 15일 재생 → 고객이 잔액을 채워도 결제 동결. 크론 쪽에서 확정거절 시 count 를
 * 올리도록 고쳤다). 이 값을 앵커로 쓰면 "돈이 안 나갔음이 보장된 거절 때만
 * 키를 갈아탄다"가 정확히 표현되고, 결과 불명인 재시도는 같은 키를 유지한다.
 *
 * ★단조성(2026-08-11): count ≥ 1 이면 **직전 코드가 무엇이든** 접미사를 유지
 * 한다. 확정거절(:rN) 뒤 타임아웃이 끼면 직전 코드가 비확정이 되는데, 그때
 * 접미사를 떼면 키가 base 로 **되돌아가** 이미 저장된 응답을 재생하거나(최선)
 * 15일 뒤 같은 키로 새 청구가 되어 이중청구 위험(최악)이 생긴다. count 는
 * 성공 시에만 0 으로 리셋되고 성공하면 next_delivery_date 가 바뀌어 base 키
 * 자체가 달라지므로, 접미사가 큰 쪽으로만 움직이면 키 충돌이 없다.
 */
export function chargeRetrySuffix(
  lastFailedCode: string | null | undefined,
  failedChargeCount: number,
): string {
  const n = Number.isFinite(failedChargeCount) ? Math.max(0, failedChargeCount) : 0
  if (n === 0 && !isDefinitiveDecline(lastFailedCode)) return ''
  return `:r${n}`
}

/**
 * 연속 실패 몇 번이면 구독을 멈추나 (3-strike).
 *
 * # 왜 여기로 옮겼나 (2026-08-07 고객 실패경로 감사)
 * 이 값이 청구 크론 안에만 있었고, **카드 재등록 시 자동 재개 판정**은 그걸
 * 몰라서 다른 조건(`requires_billing_key_renewal`)만 봤다. 그 플래그는
 * **permanent(카드 만료)** 에서만 켜진다. 즉:
 *
 *   원인 불명 3회 실패 → 자동 일시정지 → 메일: "카드 등록 시 자동 해제돼요"
 *   → 고객이 카드 재등록 → **재개되지 않는다.**
 *
 * 메일과 화면이 약속한 것을 코드가 안 지켰다. 두 곳이 같은 숫자를 보게 한다.
 */
export const MAX_FAILED_CHARGES = 3

/**
 * 이 구독이 **결제 실패 때문에** 멈춘 것인가 — 카드 재등록으로 되살릴 대상.
 *
 * 고객이 스스로 누른 일시정지와 구분해야 한다. 그건 카드를 새로 넣었다고
 * 마음대로 재개하면 안 된다.
 */
export function isPausedByBillingFailure(sub: {
  status?: string | null
  requires_billing_key_renewal?: boolean | null
  failed_charge_count?: number | null
}): boolean {
  if (sub.status !== 'paused') return false
  // 카드 만료 등 영구 거절 — 크론이 이 플래그를 켠다.
  if (sub.requires_billing_key_renewal === true) return true
  // 원인 불명 3-strike — 플래그는 안 켜지지만 멈춘 이유는 같다.
  return (sub.failed_charge_count ?? 0) >= MAX_FAILED_CHARGES
}
