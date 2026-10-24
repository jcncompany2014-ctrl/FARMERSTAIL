/**
 * Admin 대개편 v2 — 탭 그룹 정의 (단일 정본).
 *
 * 비슷한 페이지들을 상단 AdminTabs 로 묶는다(이름은 lib/admin/page-labels 하나 — 규칙319). 사이드바(admin-shell-next)는 각 그룹의
 * 첫 항목(대표)만 노출. 여기 순서 = 탭 표시 순서.
 */
import type { AdminTab } from './ui'
import { ADMIN_PAGE_LABEL } from '@/lib/admin/page-labels'

/** 정기배송 — 구독 목록 · 배송 캘린더 · 자동결제 이력 */
export const SUBS_TABS: readonly AdminTab[] = [
  { href: '/admin/subscriptions', label: ADMIN_PAGE_LABEL['/admin/subscriptions'] },
  { href: '/admin/subscriptions/calendar', label: ADMIN_PAGE_LABEL['/admin/subscriptions/calendar'] },
  { href: '/admin/subscriptions/charges', label: ADMIN_PAGE_LABEL['/admin/subscriptions/charges'] },
]

/** 고객 — 회원 목록 · 고객 답장 · 전체 검색 */
export const CUSTOMER_TABS: readonly AdminTab[] = [
  { href: '/admin/users', label: ADMIN_PAGE_LABEL['/admin/users'] },
  { href: '/admin/cs-inbox', label: ADMIN_PAGE_LABEL['/admin/cs-inbox'] },
  { href: '/admin/search-all', label: ADMIN_PAGE_LABEL['/admin/search-all'] },
]

/** 매출·결제 — 매출 리포트 · 결제 원장 */
export const REVENUE_TABS: readonly AdminTab[] = [
  { href: '/admin/reports', label: ADMIN_PAGE_LABEL['/admin/reports'] },
  { href: '/admin/finance', label: ADMIN_PAGE_LABEL['/admin/finance'] },
]

/** 콘텐츠 — 블로그 · FAQ · 산지·공급자 */
export const CONTENT_TABS: readonly AdminTab[] = [
  { href: '/admin/blog', label: ADMIN_PAGE_LABEL['/admin/blog'] },
  { href: '/admin/faqs', label: ADMIN_PAGE_LABEL['/admin/faqs'] },
  { href: '/admin/partners', label: ADMIN_PAGE_LABEL['/admin/partners'] },
]

/** 알림 — 보내기 · 통계 */
export const PUSH_TABS: readonly AdminTab[] = [
  { href: '/admin/push-campaigns', label: ADMIN_PAGE_LABEL['/admin/push-campaigns'] },
  { href: '/admin/push-stats', label: ADMIN_PAGE_LABEL['/admin/push-stats'] },
]

/** 설정 — 운영 자동화 · 자동작업 상태 · 알고리즘 계수 · 발명 보호 플래그 */
export const SETTINGS_TABS: readonly AdminTab[] = [
  { href: '/admin/automation', label: ADMIN_PAGE_LABEL['/admin/automation'] },
  { href: '/admin/cron-health', label: ADMIN_PAGE_LABEL['/admin/cron-health'] },
  { href: '/admin/algorithm', label: ADMIN_PAGE_LABEL['/admin/algorithm'] },
  { href: '/admin/invention-flags', label: ADMIN_PAGE_LABEL['/admin/invention-flags'] },
]
