/**
 * 웹 가게 주문 만들기 — 순수 함수(서버 app/api/store/orders 가 쓴다, 테스트 lib/store/store.test.ts).
 *
 * 금액은 언제나 상품표에서 다시 계산한다(cartSummary) — 브라우저가 보낸 값은 '무엇을 몇 개'뿐이다.
 * 주문 품목(order_items)은 레시피 행(products)을 가리킨다:
 *  - 레시피 500g·1kg → 그 레시피 행 1줄(이름 '닭고기 화식 500g', 단가 = 판매가, 수량 = 봉지 수).
 *  - 4종 체험팩 → 레시피 4행에 100g 한 팩씩 4줄(단가 = 체험팩 값 ÷ 4, 수량 = 세트 수). 합은 체험팩 값과 같다.
 * 결제 승인(app/api/payments/confirm)이 품목 합 = 상품 금액을 다시 대조한다.
 */
import { cartSummary, normalizeCart, type CartLine } from './cart.ts'
import { RECIPE_PRODUCT_NAME, STORE_RECIPES, TRIAL_ITEM, type StoreRecipe } from './catalog.ts'
import { formatKoreanMobile, isKoreanMobile } from '../phone.ts'

export type Recipient = {
  name: string
  phone: string
  zip: string
  address: string
  addressDetail: string
  /** 받는 방법(문 앞·경비실·직접) + 공동현관 출입 방법 — 택배 메모. */
  memo: string
}

export type OrderItemDraft = {
  recipe: StoreRecipe
  product_name: string
  variant_name: string
  unit_price: number
  quantity: number
  line_total: number
}

/** 휴대폰 번호 → 010-1234-5678(정본 lib/phone — 규칙33). 휴대폰이 아니면 null. */
export function normalizeMobile(raw: string): string | null {
  if (!isKoreanMobile(raw ?? '')) return null
  return formatKoreanMobile(raw)
}

/** 받는 분 정보 검사 — 문제가 있으면 고객에게 보일 말, 없으면 정리된 값. */
export function validateRecipient(r: Partial<Recipient> | null | undefined): { ok: true; value: Recipient } | { ok: false; message: string } {
  const name = (r?.name ?? '').trim()
  const phone = normalizeMobile(r?.phone ?? '')
  const zip = (r?.zip ?? '').trim()
  const address = (r?.address ?? '').trim()
  const addressDetail = (r?.addressDetail ?? '').trim()
  const memo = (r?.memo ?? '').trim()
  if (!name || name.length > 30) return { ok: false, message: '받는 분 이름을 확인해 주세요' }
  if (!phone) return { ok: false, message: '휴대폰 번호를 확인해 주세요' }
  if (!/^\d{5}$/.test(zip) || !address) return { ok: false, message: '주소를 우편번호 찾기로 넣어 주세요' }
  if (address.length > 200 || addressDetail.length > 100) return { ok: false, message: '주소가 너무 길어요' }
  if (memo.length > 200) return { ok: false, message: '받는 방법 메모가 너무 길어요' }
  return { ok: true, value: { name, phone, zip, address, addressDetail, memo } }
}

/** 장바구니 → 주문 품목 초안. 빈 장바구니면 빈 배열. */
export function orderItemsFromCart(lines: CartLine[]): OrderItemDraft[] {
  const s = cartSummary(normalizeCart(lines))
  const out: OrderItemDraft[] = []
  for (const l of s.lines) {
    if (l.item.kind === 'recipe' && l.item.recipe && l.item.size) {
      out.push({
        recipe: l.item.recipe,
        product_name: l.item.name,
        variant_name: l.item.size,
        unit_price: l.item.price,
        quantity: l.qty,
        line_total: l.lineTotal,
      })
    } else {
      const per = TRIAL_ITEM.price / STORE_RECIPES.length
      for (const r of STORE_RECIPES) {
        out.push({
          recipe: r,
          product_name: `${RECIPE_PRODUCT_NAME[r]} 100g (4종 체험팩)`,
          variant_name: '4종 체험팩',
          unit_price: per,
          quantity: l.qty,
          line_total: per * l.qty,
        })
      }
    }
  }
  return out
}

/** 토스 결제창에 보일 주문 이름 — '닭고기 화식 500g 외 1건'(100자 안). */
export function orderNameFor(lines: CartLine[]): string {
  const s = cartSummary(normalizeCart(lines))
  if (s.lines.length === 0) return '파머스테일 화식'
  const first = s.lines[0]!.item.name
  return (s.lines.length > 1 ? `${first} 외 ${s.lines.length - 1}건` : first).slice(0, 100)
}
