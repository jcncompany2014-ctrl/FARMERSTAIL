import { permanentRedirect } from 'next/navigation'

/**
 * /collections — 구독 전용 전환(2026-06-26 사장님 지시)으로 낱개 큐레이션 폐지.
 * 낱개 상품 "모음전"을 없애고 설문 퍼널(/start)로 보낸다.
 *
 * ★`redirect()`(307 임시)가 아니라 `permanentRedirect()`(308) 다 — 2026-09-08
 *  사장님 제보로 고침. 307 은 검색엔진에 "원래 주소는 그대로 유효하다"는
 *  신호라, 폐지 3개월 뒤에도 네이버가 옛 컬렉션(/collections/first-meal)의
 *  **제목·설명·썸네일을 그대로 노출**하고 있었다(구 AI 사진 포함). 영구
 *  폐지된 URL 은 308 로 보내야 색인이 목적지로 이전되고 옛 항목이 정리된다.
 *
 * ⚠️ 이 규칙은 **URL 자체가 영구 폐지된 경우에만** 적용한다. 로그인 가드·
 *  앱/웹 분기처럼 조건에 따라 달라지는 리다이렉트와, /reviews 같은 **임시**
 *  숨김은 307(`redirect`)을 유지해야 한다 — 308 은 브라우저가 영구 캐시해서
 *  조건이 바뀌어도 계속 튕긴다.
 */
export default function CollectionsPage() {
  permanentRedirect('/start')
}
