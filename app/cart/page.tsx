import { redirect } from 'next/navigation'

/**
 * /cart — 구독 전용 전환(2026-06-26)으로 낱개 장바구니 폐지.
 * 구독은 장바구니를 쓰지 않으므로 설문 퍼널(/start)로 보낸다.
 */
export default function CartPage() {
  redirect('/start')
}
