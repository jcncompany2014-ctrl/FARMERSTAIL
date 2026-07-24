/**
 * Admin 대개편 v2 — 탭 그룹 정의 (단일 정본).
 *
 * 비슷한 페이지들을 상단 AdminTabs 로 묶는다. 사이드바(AdminNav)는 각 그룹의
 * 첫 항목(대표)만 노출. 여기 순서 = 탭 표시 순서.
 */
import type { AdminTab } from './ui'

/** 정기배송 — 구독 목록 · 배송 캘린더 · 자동결제 이력 */
export const SUBS_TABS: readonly AdminTab[] = [
  { href: '/admin/subscriptions', label: '구독 목록' },
  { href: '/admin/subscriptions/calendar', label: '배송 캘린더' },
  { href: '/admin/subscriptions/charges', label: '자동결제 이력' },
]

/** 고객 — 회원 목록 · 고객 답장 · 전체 검색 */
export const CUSTOMER_TABS: readonly AdminTab[] = [
  { href: '/admin/users', label: '회원 목록' },
  { href: '/admin/cs-inbox', label: '고객 답장' },
  { href: '/admin/search-all', label: '전체 검색' },
]

/** 매출·결제 — 매출 리포트 · 결제 원장 */
export const REVENUE_TABS: readonly AdminTab[] = [
  { href: '/admin/reports', label: '매출 리포트' },
  { href: '/admin/finance', label: '결제 원장' },
]

/** 콘텐츠 — 블로그 · FAQ · 산지·공급자 */
export const CONTENT_TABS: readonly AdminTab[] = [
  { href: '/admin/blog', label: '블로그' },
  { href: '/admin/faqs', label: 'FAQ' },
  { href: '/admin/partners', label: '산지·공급자' },
]

/** 알림 — 보내기 · 통계 */
export const PUSH_TABS: readonly AdminTab[] = [
  { href: '/admin/push-campaigns', label: '알림 보내기' },
  { href: '/admin/push-stats', label: '알림 통계' },
]

/** 설정 — 운영 자동화 · 자동작업 상태 · 알고리즘 계수 · 발명 보호 플래그 */
export const SETTINGS_TABS: readonly AdminTab[] = [
  { href: '/admin/automation', label: '운영 자동화' },
  { href: '/admin/cron-health', label: '자동작업 상태' },
  { href: '/admin/algorithm', label: '알고리즘 계수' },
  { href: '/admin/invention-flags', label: '발명 보호' },
]
