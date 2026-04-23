/**
 * Farmer's Tail — 재고 분류 유틸.
 *
 * DB의 `products.stock` (integer, NOT NULL, default 0) 하나를 UI에서 3가지
 * 상태로 나눠 쓴다. 단순한 `stock > 0` 분기 이상이 필요해진 건, 사용자가
 * "지금 사도 되나? 빠른 배송될까?" 같은 힌트를 카드 타일 단계에서 받고
 * 싶어하기 때문.
 *
 *   - 'out'     : stock <= 0        →  "품절" 뱃지, CTA 잠금
 *   - 'low'     : 0 < stock <= LOW  →  "재고 소량" 뱃지, CTA는 그대로
 *   - 'in_stock': stock > LOW       →  뱃지 없음, 평시 렌더
 *
 * 임계치는 카테고리 공통 5 — 반려견 식품 소포장이라 재고 10 이하면 대체로
 * 당일 소진이라서 5가 UX-적절 값. 크게 키우면 모든 상품이 "소량"으로 보여
 * 신호가 마비되고, 0에 가까우면 "품절 직전 긴박" 신호가 약해진다.
 *
 * 나중에 variants가 도입되면(Step 14) 변형별 stock이 우선이고, 이 함수가
 * 집계 값(variants.sum or min)을 받아서 분류하게 된다. 단일 타입 `number`
 * 라 그때 시그니처는 안 바뀐다.
 */

/** 재고 "소량" 으로 볼 경계 임계치 — 경고 뱃지가 떠야 할 수량. */
export const STOCK_LOW_THRESHOLD = 5 as const

export type StockState = 'in_stock' | 'low' | 'out'

export function stockState(
  stock: number | null | undefined,
  threshold: number = STOCK_LOW_THRESHOLD
): StockState {
  // null/undefined는 안전하게 품절로 — 관리자 실수로 누락돼도 구매는 막는다.
  if (stock === null || stock === undefined) return 'out'
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'in_stock'
}

export function isSoldOut(
  stock: number | null | undefined
): boolean {
  return stockState(stock) === 'out'
}

/**
 * 장바구니/PDP 수량 스텝퍼의 "최대값" 계산. 재고 이하 + 주문당 상한(기본 99)
 * 둘 중 작은 값. 품절이면 0.
 *
 * @param hardMax - 주문당 상한 (UX 안전장치). 기본 99.
 */
export function maxOrderable(
  stock: number | null | undefined,
  hardMax: number = 99
): number {
  if (stock === null || stock === undefined || stock <= 0) return 0
  return Math.min(stock, hardMax)
}

/**
 * 사용자에게 보여줄 재고 문구. "재고 3개 남음" 등. low 상태일 때만 의미 있음.
 * out/in_stock은 빈 문자열을 돌려주므로 호출처가 !!라벨 체크만 하면 됨.
 */
export function stockMessage(
  stock: number | null | undefined
): string {
  const state = stockState(stock)
  if (state === 'out') return '품절'
  if (state === 'low' && typeof stock === 'number') {
    return `재고 ${stock}개 남음`
  }
  return ''
}
