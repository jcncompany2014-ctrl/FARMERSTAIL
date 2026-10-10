import { permanentRedirect } from 'next/navigation'

/**
 * /checkout — 구독 전용 전환(2026-06-26 사장님 지시)으로 낱개 체크아웃 폐지.
 * 구독 결제는 별도 흐름(/subscribe · dogs/[id]/order)이라 /checkout 미사용(확인됨).
 * 낱개 결제 진입을 막고 설문 퍼널(/start)로 보낸다.
 * ⚠️ 결제 확정 API(payments/confirm)·checkout/success 는 보존(불변).
 *
 * ★2026-10-10 웹 리뉴얼(웹 = 단품 가게): 목적지를 새 가게(/store)로 바꿨다. 옛 주소는 그대로 308. 주문서는 장바구니에서 들어간다.
 */
export default function CheckoutPage() {
  permanentRedirect('/store/cart')
}
