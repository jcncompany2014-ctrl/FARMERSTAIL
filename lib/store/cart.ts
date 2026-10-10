/**
 * 웹 가게 장바구니 — 순수 함수. 저장은 브라우저(localStorage, components/store/useStoreCart)가 하고,
 * 금액은 **언제나 이 함수로 상품표(catalog)에서 다시 계산**한다 — 저장된 값(가격)을 믿지 않는다.
 * 서버 주문 생성(app/api/store/orders)도 같은 cartSummary 로 계산한다(화면 금액 = 청구 금액).
 *
 * 장바구니 테이블은 6월 구독 전용 전환 때 없어졌다 — 새로 만들지 않는다(로그인 전에도 담을 수 있게 브라우저에).
 */
import { isStoreItemId, storeItem, type StoreItem, type StoreItemId } from './catalog.ts'
import { shippingFeeFor, untilFreeShipping } from './shipping.ts'

export type CartLine = { id: StoreItemId; qty: number }
/** 한 품목 최대 수량 — 냉동 상자 하나에 들어가는 양을 넘지 않게. */
export const MAX_QTY = 10
/** 품목 종류 최대 — 9종(레시피 4×2 + 체험팩)이 전부. */
export const MAX_LINES = 9

function clampQty(q: unknown): number {
  const n = typeof q === 'number' ? q : Number(q)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(MAX_QTY, Math.floor(n)))
}

/** 저장소에서 읽은 값을 믿지 않는다 — 없는 상품·이상한 수량은 버리고, 같은 상품은 합친다. */
export function normalizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return []
  const merged = new Map<StoreItemId, number>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const id = (r as { id?: unknown }).id
    if (!isStoreItemId(id)) continue
    const qty = clampQty((r as { qty?: unknown }).qty)
    if (qty <= 0) continue
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + qty))
  }
  return [...merged.entries()].slice(0, MAX_LINES).map(([id, qty]) => ({ id, qty }))
}

export function addToCart(lines: CartLine[], id: StoreItemId, qty = 1): CartLine[] {
  return normalizeCart([...lines, { id, qty }])
}

/** 수량을 정해 넣는다(0 이면 뺀다). */
export function setQty(lines: CartLine[], id: StoreItemId, qty: number): CartLine[] {
  const q = clampQty(qty)
  const rest = lines.filter((l) => l.id !== id)
  if (q <= 0) return normalizeCart(rest)
  const idx = lines.findIndex((l) => l.id === id)
  const next = [...rest]
  next.splice(idx < 0 ? next.length : idx, 0, { id, qty: q })
  return normalizeCart(next)
}

export function removeFromCart(lines: CartLine[], id: StoreItemId): CartLine[] {
  return setQty(lines, id, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0)
}

export type CartSummaryLine = { item: StoreItem; qty: number; lineTotal: number }
export type CartSummary = {
  lines: CartSummaryLine[]
  subtotal: number
  shippingFee: number
  total: number
  /** 무료배송까지 남은 금액. */
  untilFree: number
}

export function cartSummary(lines: CartLine[]): CartSummary {
  const norm = normalizeCart(lines)
  const out = norm.map((l) => {
    const item = storeItem(l.id)
    return { item, qty: l.qty, lineTotal: item.price * l.qty }
  })
  const subtotal = out.reduce((s, l) => s + l.lineTotal, 0)
  const shippingFee = shippingFeeFor(subtotal)
  return { lines: out, subtotal, shippingFee, total: subtotal + shippingFee, untilFree: untilFreeShipping(subtotal) }
}
