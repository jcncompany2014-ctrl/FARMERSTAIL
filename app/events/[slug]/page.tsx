import { redirect } from 'next/navigation'

/**
 * /events/[slug] — 구독 전용 전환(2026-06-26)으로 이벤트 상세 폐지.
 * 설문 퍼널(/start)로 보낸다.
 */
export default function EventDetailPage() {
  redirect('/start')
}
