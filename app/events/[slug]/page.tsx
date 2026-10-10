import { permanentRedirect } from 'next/navigation'

/**
 * /events/[slug] — 구독 전용 전환(2026-06-26)으로 이벤트 상세 폐지.
 * 2026-10-10 웹 리뉴얼: 웹 설문(/start)도 앱으로 옮겨 앱 소개(/app)로 바로 보낸다.
 */
export default function EventDetailPage() {
  permanentRedirect('/app')
}
