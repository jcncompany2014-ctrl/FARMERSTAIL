/**
 * 어드민 '고객 한 명' 화면 주소 — 정본 한 곳(2026-10-14 C1, 규칙253).
 *
 * 통합 검색·구독 목록·주문 상세·회원 목록이 고객 이름을 이 화면으로 잇는다. 주소를 화면마다 적으면 하나만 옛 주소
 * (예전엔 전부 `/message` 하위)로 남는다 — 여기서 만든다.
 * 포장 목록 카드는 구독 id 만 들고 있어(행에 user_id 가 없다) `customerHrefBySubscription` 으로 잇는다 — 그 주소가
 * 구독 주인을 찾아 이 화면으로 보낸다(app/admin/users/by-subscription/[subId]).
 *
 * `@/` 값 import 없음 — node 테스트가 그대로 읽는다.
 */

export function customerHref(userId: string): string {
  return `/admin/users/${encodeURIComponent(userId)}`
}

export function customerHrefBySubscription(subscriptionId: string): string {
  return `/admin/users/by-subscription/${encodeURIComponent(subscriptionId)}`
}

/**
 * 정기배송 한 장(/admin/subscriptions/[id]) — 2026-10-24 규칙314. 새 정기배송 알림·홈 '새로 들어온 것'·정기배송 목록 카드·
 * 달력 칩·이번 주 할 일의 이름 줄이 전부 여기로 온다(예전엔 고객 화면으로 가서 정기배송 칸을 다시 찾아야 했고, 달력은
 * 목록이 읽지도 않는 ?focus= 로 보내 헛걸음이었다).
 */
export function subscriptionHref(subscriptionId: string): string {
  return `/admin/subscriptions/${encodeURIComponent(subscriptionId)}`
}
