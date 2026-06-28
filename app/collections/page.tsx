import { redirect } from 'next/navigation'

/**
 * /collections — 구독 전용 전환(2026-06-26 사장님 지시)으로 낱개 큐레이션 폐지.
 * 낱개 상품 "모음전"을 없애고 설문 퍼널(/start)로 보낸다.
 */
export default function CollectionsPage() {
  redirect('/start')
}
