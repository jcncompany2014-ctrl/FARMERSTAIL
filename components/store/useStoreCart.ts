'use client'

/**
 * 웹 가게 장바구니 — 브라우저(localStorage)에 담고, 머리줄 숫자·상품 카드·장바구니 화면이 같은 값을 본다.
 * 저장된 값은 믿지 않는다: 읽을 때마다 lib/store/cart normalizeCart 로 상품표에 없는 것·이상한 수량을 버리고,
 * 금액은 cartSummary 가 상품표에서 다시 계산한다(서버 주문 생성도 같은 함수 — 화면 금액 = 청구 금액).
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  addToCart,
  cartCount,
  cartSummary,
  normalizeCart,
  removeFromCart,
  setQty,
  type CartLine,
} from '@/lib/store/cart'
import type { StoreItemId } from '@/lib/store/catalog'

const KEY = 'ft_store_cart_v1'
const EVT = 'ft-store-cart'

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVT, cb)
    window.removeEventListener('storage', cb)
  }
}
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '[]'
  } catch {
    return '[]'
  }
}
function getServerSnapshot(): string {
  return '[]'
}
function parse(raw: string): CartLine[] {
  try {
    return normalizeCart(JSON.parse(raw))
  } catch {
    return []
  }
}
function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    /* 사생활 보호 모드 등 — 담기는 이번 화면에서만 유지된다 */
  }
  window.dispatchEvent(new Event(EVT))
}

export function useStoreCart() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const lines = useMemo(() => parse(raw), [raw])
  const update = useCallback((fn: (l: CartLine[]) => CartLine[]) => {
    write(fn(parse(getSnapshot())))
  }, [])
  return {
    lines,
    count: cartCount(lines),
    summary: cartSummary(lines),
    qtyOf: (id: StoreItemId) => lines.find((l) => l.id === id)?.qty ?? 0,
    add: (id: StoreItemId, qty = 1) => update((l) => addToCart(l, id, qty)),
    set: (id: StoreItemId, qty: number) => update((l) => setQty(l, id, qty)),
    remove: (id: StoreItemId) => update((l) => removeFromCart(l, id)),
    clear: () => update(() => []),
  }
}

/** 결제 직전 주문서에 실을 값(서버가 다시 검증한다). */
export function readStoreCart(): CartLine[] {
  return parse(getSnapshot())
}
export function clearStoreCart() {
  write([])
}
