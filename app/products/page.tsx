import { redirect } from 'next/navigation'

/**
 * /products — 구독 전용 전환(2026-06-26 사장님 지시)으로 낱개 상품 카탈로그 폐지.
 * 낱개 판매를 없애고 설문 퍼널(/start)로 보낸다.
 */
export default function ProductsPage() {
  redirect('/start')
}
