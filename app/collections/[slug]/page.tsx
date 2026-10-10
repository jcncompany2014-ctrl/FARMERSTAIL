import { permanentRedirect } from 'next/navigation'

/**
 * /collections/[slug] — 구독 전용 전환(2026-06-26)으로 낱개 컬렉션 상세 폐지.
 * 설문 퍼널(/start)로 보낸다.
 *
 * ★2026-10-10 웹 리뉴얼(웹 = 단품 가게): 목적지를 새 가게(/store)로 바꿨다. 옛 주소는 그대로 308.
 */
export default function CollectionDetailPage() {
  permanentRedirect('/store')
}
