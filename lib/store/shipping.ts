/**
 * 웹 가게 배송비·출고일 — 2026-10-10 사장님 "시안 숫자 그대로".
 *
 * - 배송비 4,000원, 상품 금액 5만 원 이상이면 무료(기획서 D7).
 * - 출고는 화·목 주 2회, 냉동 재고에서(기획서 D8 — 금·토 출고는 주말 택배 정체로 냉동 품질 위험이라 하지 않는다).
 *   출고 전날 밤 12시까지 주문하면 그 출고일에 나간다 = **오늘 다음의 첫 화·목**.
 *   예: 수요일 주문 → 목요일 출고 · 목요일 주문 → 다음 화요일 출고.
 * - 도착 요일은 약속하지 않는다("수요일 도착" 금지 — 화면은 '출고' 날짜만, 도착은 "출고 후 하루나 이틀").
 *
 * 정기배송(주말 조리 → 화요일 발송, lib/shipping-schedule)과는 다른 규칙이다 — 섞지 않는다.
 */
import { addDaysKst } from '../datetime-kst.ts'

export const SHIPPING_FEE = 4_000
export const FREE_SHIPPING_MIN = 50_000
/** 출고 요일(0=일 … 6=토) — 화·목. */
export const STORE_SHIP_WEEKDAYS: readonly number[] = [2, 4]

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 상품 금액에 붙는 배송비. 빈 장바구니는 0. */
export function shippingFeeFor(subtotal: number): number {
  if (subtotal <= 0) return 0
  return subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE
}

/** 무료배송까지 남은 금액(이미 무료면 0). */
export function untilFreeShipping(subtotal: number): number {
  return Math.max(0, FREE_SHIPPING_MIN - subtotal)
}

function weekdayOf(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay()
}

/** 오늘(KST yyyy-mm-dd) 주문의 출고일 — 오늘 다음의 첫 화·목. */
export function storeShipDate(todayIso: string): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDaysKst(todayIso, i)
    if (STORE_SHIP_WEEKDAYS.includes(weekdayOf(d))) return d
  }
  // 도달 불가(출고 요일이 비어 있지 않은 한) — 안전하게 일주일 뒤.
  return addDaysKst(todayIso, 7)
}

/** '2026-10-08' → '10월 8일(목)'. */
export function shipDateLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}월 ${d}일(${WEEKDAY_KO[weekdayOf(isoDate)]})`
}
