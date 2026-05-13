'use client'

/**
 * 강아지 detail 탭 nav.
 *
 * 11개 sub-route 를 5개 그룹으로 묶어 사용자가 한 페이지 안에서 길 잃지 않게.
 *
 *   개요  — /dogs/{id}                              (강아지 정보 / 다음 일정)
 *   기록  — /dogs/{id}/health                       (체중·컨디션 로그)
 *   분석  — /dogs/{id}/analyses                     (분석 히스토리; survey/analysis 진행)
 *   처방  — /dogs/{id}/formulas                     (처방 목록 + approve sub-route 진입)
 *   구독  — /dogs/{id}/order                        (정기배송 신청·관리)
 *
 * 별도 유지 (탭에 노출 X): /edit, /reminders, /checkin (액션-driven sub-route).
 *
 * 디자인: 강아지 page chrome 상단에 sticky bar 로 붙임. 5개 칸 균등 grid,
 * 활성 탭은 terracotta underline + bold. 모바일 친화 — 한 손 엄지.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dog, Camera, BarChart3, ClipboardList, Repeat } from 'lucide-react'

type Tab = {
  href: (id: string) => string
  isActive: (path: string, id: string) => boolean
  label: string
  Icon: typeof Dog
}

const TABS: readonly Tab[] = [
  {
    href: (id) => `/dogs/${id}`,
    isActive: (path, id) => path === `/dogs/${id}`,
    label: '개요',
    Icon: Dog,
  },
  {
    // 기록 = 사진 일기 (매일 retention 핵심). 컨디션·체중 등 health log 는
    // diary 페이지에서 별도 link 로 진입.
    href: (id) => `/dogs/${id}/diary`,
    isActive: (path, id) =>
      path.startsWith(`/dogs/${id}/diary`) ||
      path.startsWith(`/dogs/${id}/health`) ||
      path.startsWith(`/dogs/${id}/checkin`),
    label: '기록',
    Icon: Camera,
  },
  {
    href: (id) => `/dogs/${id}/analyses`,
    isActive: (path, id) =>
      path.startsWith(`/dogs/${id}/analyses`) ||
      path.startsWith(`/dogs/${id}/analysis`) ||
      path.startsWith(`/dogs/${id}/survey`),
    label: '분석',
    Icon: BarChart3,
  },
  {
    href: (id) => `/dogs/${id}/formulas`,
    isActive: (path, id) =>
      path.startsWith(`/dogs/${id}/formulas`) ||
      path.startsWith(`/dogs/${id}/approve`),
    label: '처방',
    Icon: ClipboardList,
  },
  {
    href: (id) => `/dogs/${id}/order`,
    isActive: (path, id) => path.startsWith(`/dogs/${id}/order`),
    label: '구독',
    Icon: Repeat,
  },
] as const

/**
 * 액션 중심 sub-route (survey/checkin/approve) 에서는 tab nav 자체를 숨김.
 * 사용자가 흐름에 집중할 수 있게 시각 부담 ↓. 사용자 피드백 반영.
 */
const HIDE_ON_PATHS = ['/survey', '/checkin', '/approve']

export default function DogTabsNav({ dogId }: { dogId: string }) {
  const pathname = usePathname()
  if (HIDE_ON_PATHS.some((p) => pathname.includes(p))) return null

  return (
    <nav
      className="sticky top-14 z-30 bg-bg/95 backdrop-blur-xl border-b border-rule"
      aria-label="강아지 메뉴"
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, isActive, label, Icon }) => {
          const active = isActive(pathname, dogId)
          return (
            <Link
              key={label}
              href={href(dogId)}
              className="relative flex flex-col items-center justify-center py-2 transition active:scale-[0.97]"
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`w-[18px] h-[18px] transition ${
                  active ? 'text-text' : 'text-muted'
                }`}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className={`mt-1 text-[10.5px] font-bold tracking-tight ${
                  active ? 'text-text' : 'text-muted'
                }`}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                  style={{ background: 'var(--terracotta)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
