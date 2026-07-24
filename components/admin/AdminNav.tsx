'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * AdminNav — 관리자 사이드바 네비게이션 (client island).
 *
 * 기존 layout.tsx 의 평면 22-link nav 를 대체. 개선점:
 *  1. **그룹화** — 운영 / 분석 / 상품·콘텐츠 / 개인화·시스템 4 섹션으로 묶어
 *     28개 링크를 스캔 가능하게. (시인성)
 *  2. **active 하이라이트** — 현재 경로를 longest-prefix 매칭으로 강조.
 *     (이전엔 현재 위치를 알 수 없었음.)
 *  3. **누락 링크 복구** — 블로그 / 배송 캘린더 / 전환 퍼널 / 포뮬러 승인 /
 *     개인화 인사이트 / Cron 상태는 페이지가 존재하지만 사이드바에 없어
 *     URL 직접 입력으로만 접근 가능했다 → nav 에 추가. (기능 부족 해소)
 *
 * 2026-07-19 대개편: 다크 사이드바 폐기 → 밝은 브랜드 크림 톤(#FBFAF6).
 * active = terracotta 좌측 보더 + terracotta 배경 틴트.
 */

interface NavLink {
  href: string
  icon: string
  label: string
}

interface NavGroup {
  label: string
  items: NavLink[]
}

/**
 * 대개편 v2 T7 (2026-07-24 사장님 확정) — "실제 하는 일" 순서 4그룹.
 * 비슷한 페이지는 대표 1개만 노출(나머지는 페이지 상단 AdminTabs 로 이동):
 *   정기배송[구독|캘린더|자동결제] · 고객[회원|답장|검색] · 매출·결제[리포트|원장]
 *   콘텐츠[블로그|FAQ|산지] · 알림[보내기|통계] · 설정[자동화|자동작업|알고리즘|발명보호]
 * 분석 4종은 "추후 개발"로 강등(삭제 대신 — 나중에 볼 수 있게).
 */
const GROUPS: NavGroup[] = [
  {
    label: '매일',
    items: [
      { href: '/admin', icon: '📊', label: '대시보드' },
      { href: '/admin/orders', icon: '📦', label: '주문 관리' },
      { href: '/admin/subscriptions', icon: '🔁', label: '정기배송' },
      // 발송 화요일마다 쓰는 핵심 화면.
      { href: '/admin/personalization/picking-list', icon: '🧑‍🍳', label: '박스 패킹' },
      { href: '/admin/personalization', icon: '✅', label: '레시피 승인' },
      { href: '/admin/users', icon: '👥', label: '고객' },
      { href: '/admin/refunds', icon: '↩️', label: '환불 관리' },
    ],
  },
  {
    label: '돈',
    items: [
      { href: '/admin/reports', icon: '📈', label: '매출·결제' },
      { href: '/admin/loyalty', icon: '🏅', label: '멤버십·스탬프' },
    ],
  },
  {
    label: '가끔',
    items: [
      { href: '/admin/products', icon: '🛍️', label: '제품 관리' },
      { href: '/admin/blog', icon: '✍️', label: '콘텐츠' },
      { href: '/admin/push-campaigns', icon: '📣', label: '알림' },
      { href: '/admin/promotions', icon: '🎟️', label: '이벤트 · 프로모션' },
      { href: '/admin/automation', icon: '🎛️', label: '설정' },
    ],
  },
  {
    label: '추후 개발',
    items: [
      { href: '/admin/funnel', icon: '🪜', label: '가입 여정 분석' },
      { href: '/admin/cohort', icon: '🧪', label: '가입 시기별 분석' },
      { href: '/admin/personalization-insights', icon: '🧠', label: '맞춤 분석' },
      { href: '/admin/beta-cohort', icon: '🧬', label: '베타 테스트' },
    ],
  },
]

/** 모든 nav href 중 현재 pathname 에 가장 길게 매칭되는 href 를 active 로. */
function activeHref(pathname: string): string | null {
  const all = GROUPS.flatMap((g) => g.items.map((i) => i.href))
  let best: string | null = null
  for (const href of all) {
    const matches =
      href === '/admin'
        ? pathname === '/admin'
        : pathname === href || pathname.startsWith(href + '/')
    if (matches && (best === null || href.length > best.length)) {
      best = href
    }
  }
  return best
}

export default function AdminNav() {
  const pathname = usePathname()
  const active = activeHref(pathname)

  return (
    <nav className="px-3 py-4 space-y-4" aria-label="관리자 메뉴">
      {GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            {group.label}
          </p>
          {group.items.map((item) => {
            const isActive = item.href === active
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 pl-[10px] pr-3 py-2 rounded-md text-[13px] border-l-2 transition ${
                  isActive
                    ? 'border-terracotta bg-terracotta/10 text-zinc-900 font-semibold'
                    : 'border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <span className="text-[15px] leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
