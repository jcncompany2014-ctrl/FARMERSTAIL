/**
 * 웹 가게 환불 문구 정본 — 사장님 2026-10-13(토스 일반결제 심사 준비) "환불 조건 문구를 하나로".
 * 화면(해요체)과 약관·환불정책(합니다체)이 같은 조건을 말한다: 받은 날부터 7일 · 진공 포장(팩)을 뜯지 않았으면 · 상자를 연 것은 괜찮다.
 * 반품 배송비 숫자는 여기 적지 않는다 — lib/store/shipping 의 RETURN_SHIPPING_FEE · returnShippingFeeFor 가 정본(화면에 숫자를 박지 않는다).
 * 결제수단은 카드·간편결제만(사장님이 토스 상점관리자에서 계좌이체·가상계좌를 끈다) — 환불 방법도 그 둘만 말한다.
 */
import { SHIPPING_FEE, returnShippingFeeFor } from './shipping.ts'

/** 화면(해요체) — 상품 상세·체험팩·주문서. */
export const REFUND_RULE_HAEYO = '받은 날부터 7일 안, 팩(진공 포장)을 뜯지 않았다면 환불돼요. 상자를 열어 확인한 건 괜찮아요.'

/** 약관·환불정책(합니다체). */
export const REFUND_RULE_HAMNIDA =
  '상품을 받은 날부터 7일 이내, 진공 포장(팩)을 개봉하지 않았다면 청약철회(환불)할 수 있습니다. 상품을 확인하려고 배송 상자를 연 것은 개봉으로 보지 않습니다.'

/** 환불 방법(해요체) — 카드는 승인 취소, 간편결제는 결제한 수단으로 취소. */
export const REFUND_METHOD_HAEYO = '환불은 결제한 방법 그대로 돌려드려요. 카드는 승인 취소, 간편결제는 결제한 수단으로 취소돼요.'

const won = (n: number) => n.toLocaleString('ko-KR')

/**
 * 단순 변심 반품 배송비 한 줄 — '편도 5,000원 · 무료배송이면 왕복 10,000원'.
 * 받을 때 배송비를 냈으면 편도, 5만 원 이상 무료로 받았으면 왕복(returnShippingFeeFor).
 */
export function returnFeeSummary(): string {
  return `편도 ${won(returnShippingFeeFor(SHIPPING_FEE))}원 · 무료배송이면 왕복 ${won(returnShippingFeeFor(0))}원`
}

/** 이 주문의 단순 변심 반품 배송비 — 주문서에서 낸 배송비(paidShippingFee)로 편도·왕복을 가른다. */
export function returnFeeForOrder(paidShippingFee: number): string {
  const fee = returnShippingFeeFor(paidShippingFee)
  return paidShippingFee > 0 ? `편도 ${won(fee)}원` : `무료배송이라 왕복 ${won(fee)}원`
}
