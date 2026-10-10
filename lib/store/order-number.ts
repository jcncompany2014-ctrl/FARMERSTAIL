/**
 * 웹 가게 주문번호 — 'FTS-YYYYMMDD-XXXXXX'. 정기배송 주문은 'FT-YYYYMMDD-…'(subscription-charge).
 * 머리글자 하나로 두 갈래를 가른다: 토스 가맹점 키(웹 가게 = 결제위젯 계약, lib/payments/toss merchantForOrderNumber)와
 * 재고 되돌림 여부(lib/commerce/stock-gate). 토스 orderId 규칙(6~64자, 영문·숫자·-·_) 안이다.
 */
export const STORE_ORDER_PREFIX = 'FTS-'

export function isStoreOrderNumber(n: string | null | undefined): boolean {
  return typeof n === 'string' && n.startsWith(STORE_ORDER_PREFIX)
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 헷갈리는 0·O·1·I 빼고

/** KST 날짜 + 무작위 6자. rand 는 테스트용(0~1 값 6개를 차례로). */
export function storeOrderNumber(now: Date = new Date(), rand: () => number = Math.random): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const ymd = kst.toISOString().slice(0, 10).replace(/-/g, '')
  let tail = ''
  for (let i = 0; i < 6; i++) tail += ALPHABET[Math.floor(rand() * ALPHABET.length) % ALPHABET.length]
  return `${STORE_ORDER_PREFIX}${ymd}-${tail}`
}
