/**
 * 첫 결제(그리고 매 결제)에 붙을 할인 하나 고르기 — 순수 규칙(테스트: discount-pick.test.ts).
 *
 * resolveAutoDiscount 가 DB 에서 등급·이벤트·이웃 할인을 읽어 이리로 넘긴다. 규칙은 전과 같다:
 *  · 절대 더하지 않는다 — 셋 중 **가장 많이 깎는 것 하나**(pickBetterDiscount → pickWithNeighbor).
 *  · 같으면 등급(매번 붙는 것)을 쓰고, 이벤트·이웃 할인(한 번 쓰면 끝)은 아껴 둔다.
 *
 * ★2026-10-19 — 이벤트에 **최대 할인 금액**이 생겼다(사장님 "50% · 최대 5만원"). 상한이 걸리면 '50%'가 실제론
 *   더 적게 깎으니, 비율로 견주면 더 많이 깎는 이웃 할인을 상한 걸린 이벤트가 이긴다(고객이 덜 할인받는다).
 *   그래서 **실제 금액**으로 견준다 — 세 금액을 같은 박스 금액으로 나눠 넘기므로 금액이 같으면 비율도 정확히 같다.
 */
import { applyDiscount } from '../discount.ts'
import { capPromotionDiscount, pickBetterDiscount } from '../promotions.ts'
import { pickWithNeighbor } from './neighbor.ts'

export type DiscountPickInput = {
  /** 할인 전 금액(원). */
  subtotal: number
  tier: { rate: number; label: string }
  /** 아직 안 쓴 이벤트 혜택 — 없으면 null. maxDiscount null = 상한 없음. */
  promo: { rate: number; maxDiscount: number | null; label: string } | null
  /** 아직 안 쓴 이웃 할인율 — 없으면 0. */
  neighborRate: number
}

export type DiscountPickResult = {
  kind: 'tier' | 'promotion' | 'neighbor' | 'none'
  discountAmount: number
  label: string
}

export function pickDiscount({ subtotal, tier, promo, neighborRate }: DiscountPickInput): DiscountPickResult {
  const asRate = (amount: number) => (subtotal > 0 ? amount / subtotal : 0)
  const tierAmount = applyDiscount(subtotal, tier.rate)
  const promoAmount = promo && promo.rate > 0 ? capPromotionDiscount(applyDiscount(subtotal, promo.rate), promo.maxDiscount) : 0
  const neighborAmount = applyDiscount(subtotal, neighborRate)

  const picked = pickBetterDiscount(
    { rate: asRate(tierAmount), label: tier.label },
    promo && promoAmount > 0 ? { rate: asRate(promoAmount), label: promo.label } : null,
  )
  const final = pickWithNeighbor(picked, neighborAmount > 0 ? { rate: asRate(neighborAmount) } : null)
  if (final.useNeighbor) return { kind: 'neighbor', discountAmount: neighborAmount, label: final.label }
  if (picked.reason === 'promotion') return { kind: 'promotion', discountAmount: promoAmount, label: picked.label }
  if (picked.reason === 'tier') return { kind: 'tier', discountAmount: tierAmount, label: picked.label }
  return { kind: 'none', discountAmount: 0, label: '' }
}
