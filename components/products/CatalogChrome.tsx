'use client'

/**
 * CatalogChrome — 모바일 카탈로그 상단 chrome (Phase P 리뉴얼 2026-06-11).
 *
 * 이전(2026-05-21 r2): Greeting + 검색바 + 카테고리 아이콘 5타일 + "모든 메뉴"
 * 헤더 — 상품이 보이기까지 4단 chrome 이 쌓여 난잡했다 (사장님 지목).
 *
 * 리뉴얼 구성 (배달앱 그래머):
 *   1. CatalogChrome   — MENU 키커 + 큰 타이틀 + 우측 검색 버튼 (한 행)
 *   2. CatalogCategoryBar — 가로 스크롤 카테고리 필 바. 헤더 밑에 sticky 로
 *      붙어 스크롤 중에도 카테고리 전환 가능 (이전 아이콘 타일 대체).
 *
 * R21: 이 컴포넌트는 page.tsx 가 `isApp` 일 때만 렌더 — web 은 mount 자체가
 * 없다 (editorial toolbar 별도). variant prop 은 호출부 호환용으로 유지.
 *
 * 카테고리 href 는 DB 실제 category 값(한글) 정합 (마스터피스 P1-C3).
 * '정기배송'은 카테고리가 아니라 ?subscribable=1 필터.
 */

// Phase P r2 (컬리 그래머): 타이틀 행("메뉴"+검색버튼) 제거 — 센터 로고
// 헤더(AppChrome)가 브랜딩·검색·카트를 담당. 이 파일은 카테고리 바만 남긴다.
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// ─────────────────────────────────────────────────────────────
// CatalogCategoryBar — sticky 카테고리 필 바
// ─────────────────────────────────────────────────────────────

type Pill = {
  label: string
  href: string
  /** URLSearchParams 기준 활성 판정 */
  isActive: (category: string, subscribable: boolean) => boolean
}

const PILLS: Pill[] = [
  {
    label: '전체',
    href: '/products',
    isActive: (c, s) => !c && !s,
  },
  {
    label: '화식',
    href: '/products?category=화식',
    isActive: (c) => c === '화식',
  },
  {
    label: '간식·토퍼',
    href: '/products?category=간식',
    isActive: (c) => c === '간식',
  },
  {
    label: '체험팩',
    href: '/products?category=체험팩',
    isActive: (c) => c === '체험팩',
  },
  {
    label: '영양제',
    href: '/products?category=영양제',
    isActive: (c) => c === '영양제',
  },
  {
    label: '정기배송',
    href: '/products?subscribable=1',
    isActive: (c, s) => s && !c,
  },
]

export function CatalogCategoryBar() {
  const params = useSearchParams()
  const category = params?.get('category') ?? ''
  const subscribable = params?.get('subscribable') === '1'

  return (
    <nav
      aria-label="카테고리"
      className="md:hidden sticky z-30"
      style={{
        // AppChrome 헤더(--ft-header-h, A5) 바로 밑에 붙는다.
        top: 'var(--ft-header-h, 64px)',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2.5">
        {PILLS.map((pill) => {
          const active = pill.isActive(category, subscribable)
          return (
            <Link
              key={pill.label}
              href={pill.href}
              aria-current={active ? 'page' : undefined}
              className="shrink-0 inline-flex items-center font-bold transition active:scale-[0.97]"
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 999,
                fontSize: 13,
                letterSpacing: '-0.01em',
                background: active ? 'var(--ink)' : 'var(--bg-3)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--rule)',
              }}
            >
              {pill.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
