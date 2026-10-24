/**
 * 어드민 화면 이름표 — 하나(2026-10-24 어드민 2묶음 2-2, 규칙319).
 *
 * 메뉴가 37개였고 메뉴 이름과 열리는 화면 이름이 다른 곳이 27군데쯤 있었다(메뉴 '구독'을 누르면 '정기배송 관리', '처방
 * 알고리즘'을 누르면 '알고리즘 계수'). 메뉴(admin-shell-next)·탭(tabGroups)·화면 제목(h1)·위 경로가 이 표 하나를 쓴다.
 * 안 쓰는 말: 구독(→정기배송) · 체험단(→서포터즈) · CS 인박스(→고객 문의) · 크론(→자동작업) · 처방 알고리즘(→레시피 계산 설정) ·
 * 개인화(→레시피 승인) · 퍼널·코호트 · 대시보드(→홈) · 재무·원장(→결제·환불 기록) · 블로그(→매거진).
 */
export const ADMIN_PAGE_LABEL = {
  '/admin': '홈',
  '/admin/search-all': '찾기',
  '/admin/personalization/picking-list': '포장 목록',
  '/admin/orders': '주문·송장',
  '/admin/subscriptions': '정기배송',
  '/admin/subscriptions/calendar': '배송 달력',
  '/admin/subscriptions/charges': '자동결제 기록',
  '/admin/cs-inbox': '고객 문의',
  '/admin/alerts': '경보함',
  '/admin/refunds': '환불',
  '/admin/users': '고객',
  '/admin/trials': '서포터즈',
  '/admin/neighbors': '이웃 할인',
  '/admin/promotions': '이벤트 할인',
  '/admin/personalization': '레시피 승인',
  '/admin/products': '상품·재고',
  '/admin/surveys': '설문 기록',
  '/admin/push-campaigns': '알림 보내기',
  '/admin/messages': '알림톡',
  '/admin/blog': '매거진',
  '/admin/faqs': '자주 묻는 질문',
  '/admin/link': '링크 페이지',
  '/admin/reports': '매출 리포트',
  '/admin/finance': '결제·환불 기록',
  '/admin/loyalty': '도장판·등급',
  '/admin/algorithm': '레시피 계산 설정',
  '/admin/cron-health': '자동작업 상태',
  '/admin/automation': '자동화 설정',
  '/admin/invention-flags': '발명 기능',
  '/admin/partners': '산지·공급자',
  '/admin/funnel': '가입 여정',
  '/admin/cohort': '가입 시기별',
  '/admin/beta-cohort': '베타 현황',
  '/admin/personalization-insights': '맞춤 분석',
  '/admin/push-stats': '알림 통계',
} as const

export type AdminPageHref = keyof typeof ADMIN_PAGE_LABEL

export function adminPageLabel(href: AdminPageHref): string {
  return ADMIN_PAGE_LABEL[href]
}
