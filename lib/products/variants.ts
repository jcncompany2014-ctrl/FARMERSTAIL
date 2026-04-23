/**
 * Farmer's Tail — variant 모델 헬퍼.
 *
 * `product_variants` 테이블이 도입되면서, 같은 product_id 아래 여러 선택지가
 * 생긴다(중량/맛 등). UI와 장바구니/결제는 아래 규칙으로 variant를 해석한다:
 *
 *   - variants[] 가 비어 있으면 → simple product. products.price/stock이 진실.
 *   - 하나 이상 있으면 → 유저가 **선택**해야 CTA 활성. 기본 선택은
 *     `position ASC` 첫 번째 중에서 `stockState !== 'out'` 인 것, 없으면 첫 번째.
 *   - variant.price가 null이면 부모 products.price를 따라간다 (sale_price도 동일).
 *
 * PLP 가격 표시는 `variantPriceRange()`로 min/max를 뽑아 "12,000~28,000원" 같은
 * 범위로 렌더. 단일 값이면 단일 값 그대로 반환.
 */
import { stockState, type StockState } from './stock'

/** DB product_variants row (select 공용 타입). */
export interface ProductVariant {
  id: string
  product_id: string
  sku: string | null
  name: string
  option_values: Record<string, unknown>
  price: number | null
  sale_price: number | null
  stock: number
  position: number
  is_active: boolean
}

/** variant의 **유효 가격** — 자기 것이 없으면 부모 가격. sale 우선. */
export function effectivePrice(
  variant: Pick<ProductVariant, 'price' | 'sale_price'>,
  parent: { price: number; sale_price: number | null },
): number {
  const sale = variant.sale_price ?? parent.sale_price
  if (sale !== null && sale !== undefined) return sale
  return variant.price ?? parent.price
}

/** sale 여부 판정 — variant 자기 sale 또는 부모 sale 중 하나라도 있으면 true. */
export function hasSale(
  variant: Pick<ProductVariant, 'price' | 'sale_price'>,
  parent: { price: number; sale_price: number | null },
): boolean {
  return (variant.sale_price ?? parent.sale_price) !== null
}

/** variant **유효 정가** (line-through 표시용). */
export function effectiveListPrice(
  variant: Pick<ProductVariant, 'price'>,
  parent: { price: number },
): number {
  return variant.price ?? parent.price
}

/**
 * PLP 카드에서 "X~Y원" 범위 표시를 위한 유효 가격 배열.
 * 재고 0짜리 variant도 여전히 가격 범위에 포함 — 완전 품절 상태와
 * "조금 남은 variant만 있는 상태"를 UX에서 굳이 구분하지 않는다.
 */
export function variantPriceRange(
  variants: ProductVariant[],
  parent: { price: number; sale_price: number | null },
): { min: number; max: number } | null {
  if (variants.length === 0) return null
  const prices = variants
    .filter((v) => v.is_active)
    .map((v) => effectivePrice(v, parent))
  if (prices.length === 0) return null
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  }
}

/**
 * variant 기준 집계 재고. PLP 카드의 "품절" 판정은 variant 모두가 out 일 때만.
 * 단일 variant가 하나라도 재고 있으면 아직 판매 가능.
 */
export function aggregateStock(variants: ProductVariant[]): number {
  return variants
    .filter((v) => v.is_active)
    .reduce((sum, v) => sum + Math.max(0, v.stock), 0)
}

/**
 * "상품 전체" 의 재고 상태를 variant들로부터 유도.
 *   - variants가 비어 있으면 parent.stock을 직접 stockState()로 매핑.
 *   - 있으면 집계값으로 판정. low 임계치 판단은 집계값 기준.
 */
export function productStockState(
  variants: ProductVariant[],
  parent: { stock: number },
): StockState {
  if (variants.length === 0) return stockState(parent.stock)
  return stockState(aggregateStock(variants))
}

/**
 * 최초 변형 선택 — 재고 있는 것 중 position 첫 번째. 모두 품절이면 position 첫 번째.
 * variants가 비어 있으면 null (simple product — selector 불필요).
 */
export function defaultVariant(
  variants: ProductVariant[],
): ProductVariant | null {
  if (variants.length === 0) return null
  const actives = variants.filter((v) => v.is_active)
  if (actives.length === 0) return null
  const sorted = [...actives].sort((a, b) => a.position - b.position)
  const available = sorted.find((v) => stockState(v.stock) !== 'out')
  return available ?? sorted[0]
}
