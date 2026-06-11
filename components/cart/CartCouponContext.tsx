'use client'

/**
 * CartCouponContext — 장바구니(앱) 쿠폰 선택 상태 (2026-06-11).
 *
 * 사장님 지시: 장바구니 '쿠폰 사용'을 누르면 쿠폰함 페이지로 튕기지 말고,
 * 그 자리에서 사용 가능한 쿠폰이 뜨고 '적용하기'로 바로 적용 + **장바구니에서
 * 바로 할인된 금액**이 보여야 함.
 *
 * 설계(안전 우선 — 결제 금액 계산 로직 불변):
 *  - 적용/할인 미리보기는 체크아웃과 동일한 `/api/coupons/applicable?subtotal=N`
 *    의 `_expectedDiscount` 를 재사용한다(새 할인 계산 로직 만들지 않음).
 *  - 선택한 쿠폰 code 를 localStorage('ft_cart_coupon')에 저장 → 결제창
 *    (CheckoutForm)이 마운트 시 읽어 **권위 검증(validateCoupon)** 으로 자동 적용.
 *    즉 장바구니는 '미리보기', 결제창이 '확정'. 금액 계산은 결제 로직 그대로.
 *  - 수량 변경 등으로 subtotal 이 바뀌면 적용 중 쿠폰을 재해석(할인 갱신 /
 *    조건 미달 시 자동 해제).
 *
 * 이 컨텍스트는 app 카트 핸드오프(CartUpsell/CartReceipt/CartStickyCTA)에서만
 * 쓰인다. Provider 밖에서는 기본값(쿠폰 없음)이라 안전.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type AppliedCartCoupon = {
  code: string
  name: string
  /** 현재 subtotal 기준 예상 할인액(원). 결제창에서 최종 확정. */
  discount: number
}

type CartCouponValue = {
  /** 현재 장바구니 상품 합계(원) — 쿠폰 시트가 적용 가능 쿠폰 조회에 사용. */
  subtotal: number
  applied: AppliedCartCoupon | null
  /** 코드로 적용. 적용 가능하면 {ok:true} + 할인 미리보기 갱신. */
  applyByCode: (code: string) => Promise<{ ok: boolean; message?: string }>
  remove: () => void
}

const NOOP_VALUE: CartCouponValue = {
  subtotal: 0,
  applied: null,
  applyByCode: async () => ({ ok: false }),
  remove: () => {},
}

const CartCouponContext = createContext<CartCouponValue>(NOOP_VALUE)

export function useCartCoupon(): CartCouponValue {
  return useContext(CartCouponContext)
}

const STORAGE_KEY = 'ft_cart_coupon'

type ApplicableResponse = {
  available?: { code: string; name: string; _expectedDiscount: number }[]
}

export function CartCouponProvider({
  subtotal,
  children,
}: {
  subtotal: number
  children: React.ReactNode
}) {
  const [applied, setApplied] = useState<AppliedCartCoupon | null>(null)

  // 코드를 현재 subtotal 기준으로 해석 — 체크아웃과 동일한 applicable API 재사용.
  // 적용 가능하면 setApplied + persist, 불가하면 해제. {ok,message} 반환.
  const resolve = useCallback(
    async (code: string): Promise<{ ok: boolean; message?: string }> => {
      const trimmed = code.trim().toUpperCase()
      if (!trimmed) return { ok: false }
      try {
        const res = await fetch(
          `/api/coupons/applicable?subtotal=${subtotal}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return { ok: false, message: '쿠폰을 확인하지 못했어요' }
        const json = (await res.json()) as ApplicableResponse
        const match = (json.available ?? []).find((c) => c.code === trimmed)
        if (!match) {
          setApplied(null)
          try {
            window.localStorage.removeItem(STORAGE_KEY)
          } catch {
            /* storage 불가 — 표시만 해제 */
          }
          return { ok: false, message: '이 주문에 사용할 수 없는 쿠폰이에요' }
        }
        setApplied({
          code: match.code,
          name: match.name,
          discount: match._expectedDiscount,
        })
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ code: match.code }),
          )
        } catch {
          /* storage 불가 — 이번 세션만 표시 */
        }
        return { ok: true }
      } catch {
        return { ok: false, message: '쿠폰을 확인하지 못했어요' }
      }
    },
    [subtotal],
  )

  // mount: 저장된 선택 쿠폰 복원(현재 장바구니 기준 재해석).
  useEffect(() => {
    let code: string | null = null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) code = (JSON.parse(raw) as { code?: string }).code ?? null
    } catch {
      code = null
    }
    if (code) void resolve(code)
    // mount 1회만 — subtotal 변동 재해석은 아래 effect 가 담당.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // subtotal 변동(수량 변경 등) 시 적용 중 쿠폰 재해석 — 할인 갱신 / 조건 미달 해제.
  useEffect(() => {
    if (applied?.code) void resolve(applied.code)
    // subtotal 변경에만 반응(applied 를 deps 에 넣으면 setApplied 로 루프).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  const remove = useCallback(() => {
    setApplied(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
  }, [])

  return (
    <CartCouponContext.Provider
      value={{ subtotal, applied, applyByCode: resolve, remove }}
    >
      {children}
    </CartCouponContext.Provider>
  )
}
