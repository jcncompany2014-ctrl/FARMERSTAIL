import { permanentRedirect } from 'next/navigation'

/**
 * /products — 구독 전용 전환(2026-06-26 사장님 지시)으로 낱개 상품 카탈로그 폐지.
 * 낱개 판매를 없애고 설문 퍼널(/start)로 보낸다.
 *
 * ★2026-10-10 웹 리뉴얼(웹 = 단품 가게): 목적지를 새 가게(/store)로 바꿨다. 옛 주소는 그대로 308.
 */
export default function ProductsPage() {
  permanentRedirect('/store')
}
