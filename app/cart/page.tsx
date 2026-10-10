import { permanentRedirect } from 'next/navigation'

/**
 * /cart — 구독 전용 전환(2026-06-26)으로 낱개 장바구니 폐지.
 * 구독은 장바구니를 쓰지 않으므로 설문 퍼널(/start)로 보낸다.
 *
 * ★2026-10-10 웹 리뉴얼(웹 = 단품 가게): 목적지를 새 가게(/store)로 바꿨다. 옛 주소는 그대로 308.
 */
export default function CartPage() {
  permanentRedirect('/store/cart')
}
