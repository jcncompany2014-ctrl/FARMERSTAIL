'use client'

/**
 * 강아지 detail 탭 nav.
 *
 * sub-route 들을 4개 그룹으로 묶어 사용자가 한 페이지 안에서 길 잃지 않게.
 *
 *   개요  — /dogs/{id}                              (강아지 정보 / 다음 일정)
 *   기록  — /dogs/{id}/diary                        (사진·컨디션·체중 로그)
 *   분석  — /dogs/{id}/analysis                     (영양 분석 결과 + 추천 박스 일체)
 *   구독  — /dogs/{id}/order                        (정기배송 신청·관리)
 *
 * 2026-06-19 (사장님 "분석→박스 점프 비효율" 지시) — '박스'(/formulas) 탭 폐지.
 * 추천 박스는 분석 결과(/analysis)에 BoxMixCard 로 이미 인라인 표시되므로 별도
 * 탭/페이지 점프가 중복이었음. 분석 탭을 /analyses(히스토리)→/analysis(결과뷰)로
 * 직결해 1차 목적지를 '결과+박스 일체' 페이지로. 박스 cycle 이력(/formulas)·
 * survey·analyses(히스토리)·approve 는 전부 '분석' 그룹으로 하이라이트. 5탭→4탭.
 *
 * 별도 유지 (탭에 노출 X): /edit, /reminders, /checkin (액션-driven sub-route).
 *
 * 디자인: 강아지 page chrome 상단에 sticky bar 로 붙임. 5개 칸 균등 grid,
 * 활성 탭은 terracotta underline + bold. 모바일 친화 — 한 손 엄지.
 */

import type { ComponentType, CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, BarChart3, Repeat } from 'lucide-react'
import DogPawMark from '@/components/DogPawMark'

type Tab = {
  href: (id: string) => string
  isActive: (path: string, id: string) => boolean
  label: string
  // lucide 아이콘 + 커스텀 DogPawMark(개요 발바닥) 둘 다 받도록 느슨하게.
  Icon: ComponentType<{
    className?: string
    strokeWidth?: number
    style?: CSSProperties
  }>
}

const TABS: readonly Tab[] = [
  {
    href: (id) => `/dogs/${id}`,
    isActive: (path, id) => path === `/dogs/${id}`,
    label: '개요',
    Icon: DogPawMark,
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
    // 분석 = 영양 분석 결과 + 추천 박스(인라인). /analysis(매거진 결과)가 1차
    // 목적지. survey·analyses(히스토리)·formulas(박스 cycle 이력)·approve 전부
    // 이 그룹으로 하이라이트. ('/analysis' startsWith 는 '/analyses' 도 매칭)
    href: (id) => `/dogs/${id}/analysis`,
    isActive: (path, id) =>
      path.startsWith(`/dogs/${id}/analysis`) ||
      path.startsWith(`/dogs/${id}/survey`) ||
      path.startsWith(`/dogs/${id}/formulas`) ||
      path.startsWith(`/dogs/${id}/approve`),
    label: '분석',
    Icon: BarChart3,
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
      className="sticky z-30 bg-bg/95 backdrop-blur-xl border-b border-rule"
      // A5: 60px 하드코딩 → 헤더 높이 변수 + 노치 safe-area 보정. 하드코딩
      // 시절엔 노치 기기에서 헤더와 겹쳤음.
      style={{ top: 'calc(var(--ft-header-h, 64px) + env(safe-area-inset-top))' }}
      aria-label="강아지 메뉴"
    >
      {/* audit #47: 아이콘 18→20px, 라벨 10.5→11px, py-2→py-2.5, underline w-8→w-10
          — 시니어 사용자 / iOS HIG 권장 24px 에 한 단계 가까워지고 터치 row
          height 48px 이상 확보. AppChrome top h-14→h-[60px] 와 sticky top 동기화. */}
      <div className="grid grid-cols-4">
        {TABS.map(({ href, isActive, label, Icon }) => {
          const active = isActive(pathname, dogId)
          return (
            <Link
              key={label}
              href={href(dogId)}
              className="relative flex flex-col items-center justify-center py-2.5 transition active:scale-[0.97]"
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 transition ${
                  active ? 'text-text' : 'text-muted'
                }`}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className={`mt-1 text-[11px] font-bold tracking-tight ${
                  active ? 'text-text' : 'text-muted'
                }`}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full"
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
