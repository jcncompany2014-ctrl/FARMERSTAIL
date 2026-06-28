import { redirect } from 'next/navigation'

/**
 * /events — 구독 전용 전환(2026-06-26 사장님 지시)으로 프로모션 이벤트 폐지.
 * 설문 퍼널(/start)로 보낸다.
 */
export default function EventsPage() {
  redirect('/start')
}
