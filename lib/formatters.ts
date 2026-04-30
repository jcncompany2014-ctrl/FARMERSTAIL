/**
 * Farmer's Tail — string formatters.
 *
 * 한국 사용자 입력 도움 유틸. 컨트롤러 컴포넌트의 onChange 안에서 호출해
 * 즉시 자동 하이픈 / 정규화. 서버로 보낼 때는 stripHyphens() 로 다시 푼다.
 *
 * # 왜 라이브러리 안 쓰고 직접 만드나
 * - libphonenumber-js 는 국제 번호까지 다루느라 80KB+ 번들. 우리는 010 만.
 * - korean-utils, hangul-js 류는 의존이 너무 무거움. 30 줄짜리 함수면 충분.
 *
 * # 핵심 원칙
 * - **숫자만 추출 → 마스크 적용** 패턴 — IME 한글이나 영어가 들어와도 무시.
 * - **truncate-then-format** — 정해진 자리수 초과 입력은 자르고, 부족하면
 *   부족한 대로 부분 포맷. 사용자 흐름을 막지 않는다.
 * - **normalize on submit** — 화면 표시는 하이픈 포함, DB 저장은 stripHyphens.
 */

// ──────────────────────────────────────────────────────────────────────────
// Phone — 휴대폰 (010-XXXX-XXXX) / 일반 (02-XXX-XXXX, 0X-XXXX-XXXX)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 휴대폰 번호 자동 하이픈. 010 가정.
 *   "01012345678"        → "010-1234-5678"
 *   "010-1234-5678"      → "010-1234-5678" (idempotent)
 *   "0101"               → "010-1"
 *   "01012345"           → "010-1234-5"
 *   "abc010가1234"       → "010-1234"   (숫자 외 문자 제거)
 *   "012345678901234"    → "010-1234-5678" (11자리에서 자름)
 */
export function formatPhone(input: string): string {
  if (!input) return ''
  const d = input.replace(/\D+/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

/**
 * 모든 하이픈 / 공백 제거. DB 저장 / API 호출 직전에 사용.
 *   "010-1234-5678" → "01012345678"
 */
export function stripHyphens(input: string): string {
  return (input ?? '').replace(/[\s-]+/g, '')
}

/**
 * 휴대폰 번호 형식 검증. 사용자 입력 마지막 단계에서.
 *   true: "010-1234-5678", "01012345678"
 *   false: 그 외 (010 외 prefix, 자리수 부족, 한글 등)
 */
export function isValidMobilePhone(input: string): boolean {
  const d = stripHyphens(input)
  return /^010\d{7,8}$/.test(d)
}

// ──────────────────────────────────────────────────────────────────────────
// Postal code — 우편번호 (KR 5자리)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 우편번호. 항상 5자리 숫자.
 *   "12345abc" → "12345"
 *   "1234"      → "1234"  (입력 중)
 */
export function formatZip(input: string): string {
  return (input ?? '').replace(/\D+/g, '').slice(0, 5)
}

export function isValidZip(input: string): boolean {
  return /^\d{5}$/.test(input ?? '')
}

// ──────────────────────────────────────────────────────────────────────────
// Business number — 사업자등록번호 (XXX-XX-XXXXX)
// ──────────────────────────────────────────────────────────────────────────

export function formatBizNumber(input: string): string {
  if (!input) return ''
  const d = input.replace(/\D+/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

// ──────────────────────────────────────────────────────────────────────────
// Card — 신용카드 번호 (XXXX-XXXX-XXXX-XXXX)
// 결제는 Toss SDK 가 직접 받지만, 마스킹 표시용으로 가끔 필요.
// ──────────────────────────────────────────────────────────────────────────

export function formatCardNumber(input: string): string {
  if (!input) return ''
  const d = input.replace(/\D+/g, '').slice(0, 16)
  return d.match(/.{1,4}/g)?.join('-') ?? d
}

// ──────────────────────────────────────────────────────────────────────────
// Numeric helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * 천단위 콤마 추가 — 가격 / 수량 등.
 *   1234567 → "1,234,567"
 */
export function formatThousands(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return ''
  const num = typeof n === 'string' ? Number(n.replace(/,/g, '')) : n
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('ko-KR')
}

/**
 * 정수 입력 — 숫자만 + max 길이 제한. 쿠폰 코드 등에 응용.
 */
export function formatDigitsOnly(input: string, maxLen?: number): string {
  const d = (input ?? '').replace(/\D+/g, '')
  return maxLen ? d.slice(0, maxLen) : d
}

// ──────────────────────────────────────────────────────────────────────────
// Coupon code — 영문 대문자 + 숫자, 8~16자
// ──────────────────────────────────────────────────────────────────────────

export function formatCouponCode(input: string, maxLen = 16): string {
  return (input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, maxLen)
}

// ──────────────────────────────────────────────────────────────────────────
// Korean name — 한글/영문 이름. trim + 길이 제한 (UI 깨짐 방지).
// ──────────────────────────────────────────────────────────────────────────

export function formatKoreanName(input: string, maxLen = 20): string {
  return (input ?? '').replace(/^\s+/, '').slice(0, maxLen)
}
