/**
 * Farmer's Tail — 배송비 엔진.
 *
 * 지금까지 `shipping = subtotal >= 30000 ? 0 : 3000` 가 cart/checkout에 흩뿌려져
 * 있었다. 실제 운영이 시작되면 다음을 한 곳에서 결정해야 한다:
 *
 *   1. **무료배송 임계치** (기본 30,000원) — 프로모션으로 내리거나(19,000원) 없애기 쉬워야 함.
 *   2. **기본 배송비** (3,000원) — 물가/택배사 계약 변경 시 한 곳만 고침.
 *   3. **도서산간/제주 추가금** (기본 3,000원) — 우편번호 prefix로 자동 판정.
 *      대부분의 쇼핑몰은 제주만 3,000 / 그 외 도서 5,000 로 분리하지만, Farmer's
 *      Tail은 초기 단순성을 위해 "원격지" 통합 3,000으로 시작.
 *   4. **쿠폰/포인트** 에 의한 무료배송 플래그 — 다음 단계(Step 17)에서 인자로 주입.
 *
 * 이 모듈은 순수 함수다. 서버/클라이언트 어디서든 동일 입력 → 동일 출력이어야
 * 결제 금액 불일치를 방지.
 */

// --- 상수 -----------------------------------------------------------------

/** 일반 지역 기본 배송비 (원). */
export const BASE_SHIPPING_FEE = 3000 as const

/** 무료배송 임계치 (원). 이 금액 이상이면 기본 배송비 면제. */
export const FREE_SHIPPING_THRESHOLD = 30000 as const

/** 도서산간/제주 추가 배송비 (원). 무료배송 상품에도 이 추가금은 부과. */
export const REMOTE_AREA_SURCHARGE = 3000 as const

/**
 * 제주도 우편번호 prefix — 63xxx 전부.
 * (우정사업본부 기준 제주특별자치도: 63000 ~ 63644)
 */
const JEJU_PREFIX = '63'

/**
 * 도서산간 5자리 우편번호 리스트 (화이트리스트).
 * 택배사마다 정의가 다르지만 많이 쓰이는 보수적 집합으로 시작. 추후 admin-
 * tunable 테이블로 이관 가능.
 */
const REMOTE_ISLAND_ZIPS: ReadonlySet<string> = new Set([
  // 울릉도 (경북)
  '40200', '40201', '40211', '40231', '40240',
  // 백령도/대청도 (인천)
  '23100', '23101', '23102', '23103', '23104',
  // 연평도 (인천)
  '23031', '23032',
  // 흑산도 (전남)
  '58760', '58761', '58762', '58763', '58764', '58765', '58766', '58767',
  // 홍도 (전남)
  '58773', '58774',
])

// --- 판정 함수 -------------------------------------------------------------

/**
 * 주어진 우편번호가 **도서산간 추가금 대상** 인지.
 * null/공백/포맷 오류는 일반 지역으로 취급(추가금 없음) — 결제 직전 주소 입력
 * 단계에서 zip이 validate된 상태로 들어오는 것이 기대값.
 */
export function isRemoteZip(zip: string | null | undefined): boolean {
  if (!zip) return false
  const trimmed = zip.replace(/\D/g, '') // 하이픈 제거
  if (trimmed.length !== 5) return false
  if (trimmed.startsWith(JEJU_PREFIX)) return true
  if (REMOTE_ISLAND_ZIPS.has(trimmed)) return true
  return false
}

// --- 메인 계산 -------------------------------------------------------------

export interface ShippingInput {
  /** 상품 금액 (할인 전 or 할인 후 — 호출 측 일관성) */
  subtotal: number
  /** 배송지 우편번호 (미입력이면 일반 지역 추정) */
  zip?: string | null
  /**
   * 무료배송 플래그 — 쿠폰/정기구독 등 외부 로직이 강제로 "기본 배송비 0"을
   * 만들고 싶을 때. 이 플래그가 true여도 **도서산간 추가금은 면제되지 않는다**
   * (택배사 실비가 부과되므로).
   */
  forceFreeBase?: boolean
  /** 무료배송 임계치 override — 프로모션에서 일시적으로 내리고 싶을 때. */
  freeThresholdOverride?: number
}

export interface ShippingBreakdown {
  /** 일반 지역 기본 배송비 (무료 조건 미충족 시 적용). */
  base: number
  /** 도서산간 추가금. */
  remoteSurcharge: number
  /** 최종 배송비 = base + remoteSurcharge */
  total: number
  /** 기본 배송비가 면제됐는지 (무료배송 임계치 통과 또는 forceFree). */
  isBaseFree: boolean
  /** 이 주문에 적용된 무료배송 임계치. */
  freeThreshold: number
  /** 무료배송까지 남은 금액 (이미 통과했으면 0). */
  remainingToFree: number
  /** 도서산간 여부. */
  isRemote: boolean
}

/**
 * 배송비 계산. 입력에 따라 구조화된 내역을 돌려준다 — UI에서 line-item으로
 * 분해해 보여줄 수 있도록.
 */
export function calculateShipping({
  subtotal,
  zip,
  forceFreeBase = false,
  freeThresholdOverride,
}: ShippingInput): ShippingBreakdown {
  const threshold = freeThresholdOverride ?? FREE_SHIPPING_THRESHOLD
  const thresholdMet = subtotal >= threshold
  const isBaseFree = forceFreeBase || thresholdMet
  const base = isBaseFree ? 0 : BASE_SHIPPING_FEE

  const isRemote = isRemoteZip(zip)
  const remoteSurcharge = isRemote ? REMOTE_AREA_SURCHARGE : 0

  // subtotal이 0이면 배송비도 0 — 빈 카트는 비용 부과 안 됨. 단, 임계치는 이미
  // 'thresholdMet=false'로 계산되므로 명시 분기로 0 환원.
  const total = subtotal <= 0 ? 0 : base + remoteSurcharge

  const remainingToFree = Math.max(0, threshold - subtotal)

  return {
    base: subtotal <= 0 ? 0 : base,
    remoteSurcharge: subtotal <= 0 ? 0 : remoteSurcharge,
    total,
    isBaseFree,
    freeThreshold: threshold,
    remainingToFree,
    isRemote,
  }
}

/**
 * 편의 wrapper — 과거 `shipping = subtotal >= 30000 ? 0 : 3000` 을 쓰던 호출처
 * 가 한 줄로 바꿔 들어올 수 있도록. zip을 모르면 일반 지역 기준 배송비만 반환.
 */
export function calculateShippingFee(
  subtotal: number,
  zip?: string | null,
): number {
  return calculateShipping({ subtotal, zip }).total
}

// --- 레이블 helper --------------------------------------------------------

/**
 * 배송비 한 줄 사용자 문구. 결제 요약 카드의 배송비 row에서 바로 쓸 수 있음.
 *
 *   - 0원 + 기본 무료:                "무료"
 *   - 0원 + 도서산간 아님:            "무료"
 *   - 3,000원 단일:                   "3,000원"
 *   - 3,000원 + 도서산간 3,000원:     "6,000원 (도서산간 +3,000원)"
 *   - 기본 무료 + 도서산간 3,000원:   "3,000원 (도서산간 +3,000원)"
 */
export function shippingLabel(b: ShippingBreakdown): string {
  if (b.total === 0) return '무료'
  if (!b.isRemote) return `${b.total.toLocaleString()}원`
  return `${b.total.toLocaleString()}원 (도서산간 +${b.remoteSurcharge.toLocaleString()}원)`
}
