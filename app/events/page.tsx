import { permanentRedirect } from 'next/navigation'

/**
 * /events — 구독 전용 전환(2026-06-26 사장님 지시)으로 프로모션 이벤트 폐지.
 * 2026-10-10 웹 리뉴얼: 웹 설문(/start)도 앱으로 옮겨 앱 소개(/app)로 바로 보낸다(/start 를 거치면 두 번 튄다).
 */
export default function EventsPage() {
  permanentRedirect('/app')
}
