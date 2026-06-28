import { redirect } from 'next/navigation'

/**
 * /products/[slug] — 구독 전용 전환(2026-06-26)으로 낱개 상품 상세(PDP) 폐지.
 * 설문 퍼널(/start)로 보낸다. (PDP heart wishlist 잔재도 함께 소멸.)
 */
export default function ProductDetailPage() {
  redirect('/start')
}
