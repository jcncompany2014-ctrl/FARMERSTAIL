'use client'

/**
 * CatalogChrome — 모바일 카탈로그 상단 sections (2026-05-21 r2).
 *
 * app-product 핸드오프 디자인 적용:
 *   1. Greeting — "HELLO · 안녕 [강아지]" + "오늘은 뭐 먹을까?" 큰 헤딩
 *   2. Search bar + 검은 filter 버튼
 *   3. Category 5 icon row (화식·간식·토퍼·체험팩·영양제·정기배송)
 *   4. Hero 슬라이더는 **별도 컴포넌트 (CatalogHero)** 로 분리 — 이벤트 DB 연동.
 *   5. ALL · 전체 N개 + "모든 메뉴" 헤더
 *
 * # spacing
 *  - 모든 section 좌우 px-4 (16px) 통일 — 오/열 정렬 일관성.
 *  - section 간 vertical 간격은 pb-3 (12px) 표준, hero 직전만 pb-2 더 좁게.
 *
 * 데스크톱은 기존 toolbar 그대로 — 본 컴포넌트는 md:hidden.
 */

import Link from 'next/link'
import { Search, Filter } from 'lucide-react'
import { Soup, Cookie, Gift as GiftIcon, Pill, Repeat } from 'lucide-react'

interface Category {
  label: string
  href: string
  Icon: React.ComponentType<{
    size?: number
    color?: string
    strokeWidth?: number
  }>
  color: string
  hasNew?: boolean
}

// 마스터피스 P1-C3: href 를 DB 실제 category 값(한글)으로 정합. 이전 영어 슬러그
// (meal/treat/set/supp)는 DB(한글)와 안 맞아 칩 클릭 필터가 전부 깨져 있었다.
// '정기배송' 칩은 음식 카테고리가 아니라 구독상품 필터(?subscribable=1)로 유지.
const CATEGORIES: Category[] = [
  {
    label: '화식',
    href: '/products?category=화식',
    Icon: Soup,
    color: '#5d6f3f',
    hasNew: true,
  },
  {
    label: '간식·토퍼',
    href: '/products?category=간식',
    Icon: Cookie,
    color: '#e8a82e',
  },
  {
    label: '체험팩',
    href: '/products?category=체험팩',
    Icon: GiftIcon,
    color: '#dc532a',
  },
  {
    label: '영양제',
    href: '/products?category=영양제',
    Icon: Pill,
    color: '#3f7fb8',
  },
  {
    label: '정기배송',
    href: '/products?subscribable=1',
    Icon: Repeat,
    color: '#8c3a5f',
  },
]

/**
 * 한국어 이름 끝 "님" 자동 부착. 이미 "님" 으로 끝나면 그대로.
 * 영문 이름은 그대로 (Greeting kicker 톤).
 */
function withHonorific(name: string): string {
  const t = name.trim()
  if (!t) return ''
  if (t.endsWith('님')) return t
  if (/^[A-Za-z][A-Za-z\s'-]*$/.test(t)) return t
  return `${t}님`
}

export default function CatalogChrome({
  userName,
  totalCount,
  variant = 'web',
}: {
  /** 보호자 이름. */
  userName: string
  /** 전체 상품 수 (검색바 placeholder 보조) */
  totalCount: number
  /** 'web' (기본) 또는 'app' — v3 톤 분기 (R14 cleanup) */
  variant?: 'web' | 'app'
}) {
  const isApp = variant === 'app'
  return (
    <div className="md:hidden">
      {/* Greeting */}
      <section className="px-4 pt-2 pb-3">
        <div
          style={{
            fontSize: 11,
            color: '#dc532a',
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          Hello, {withHonorific(userName)}
        </div>
        <h1
          className={isApp ? undefined : "font-['Archivo_Black']"}
          style={{
            fontSize: 22,
            color: '#1a140c',
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            fontFamily: isApp
              ? "var(--font-sans), 'Pretendard', sans-serif"
              : undefined,
            fontWeight: isApp ? 900 : undefined,
          }}
        >
          오늘은 우리 아이에게
          <br />
          무엇을 먹여볼까요?
        </h1>
      </section>

      {/* Search */}
      <section className="px-4 pb-3">
        <Link
          href="/search"
          className="flex items-center gap-2.5 px-4 py-3 bg-white"
          style={{
            borderRadius: isApp ? 4 : 18,
            boxShadow: isApp ? '0 1px 0 rgba(22,20,15,0.04)' : '0 2px 8px rgba(26,20,12,0.04)',
            border: isApp ? '1px solid var(--rule)' : undefined,
          }}
        >
          <Search size={18} color="#7a6d5b" strokeWidth={1.8} />
          <span
            className="flex-1 text-[13px]"
            style={{ color: '#7a6d5b' }}
          >
            제품 · 단백질 · 알레르기 검색
          </span>
          <span
            className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center"
            style={{ background: '#1a140c' }}
          >
            <Filter size={14} color="#fff" strokeWidth={1.8} />
          </span>
        </Link>
      </section>

      {/* Category icons */}
      <section className="px-4 pb-4">
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href={cat.href}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: 54,
                  height: 54,
                  // 앱: 검색바(4=sm)와 맞춰 off-token 8 제거. 웹: editorial 18 유지.
                  borderRadius: isApp ? 4 : 18,
                  background: isApp ? 'var(--bg-3)' : '#fff',
                  boxShadow: isApp ? '0 1px 0 rgba(22,20,15,0.04)' : '0 2px 8px rgba(26,20,12,0.06)',
                  border: isApp ? '1px solid var(--rule)' : undefined,
                  color: cat.color,
                }}
              >
                <cat.Icon size={24} color={cat.color} strokeWidth={1.8} />
                {cat.hasNew && (
                  <span
                    className="absolute"
                    style={{
                      top: -3,
                      right: -3,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: '#dc532a',
                      border: '1.5px solid #fff',
                    }}
                  />
                )}
              </div>
              <span
                className="text-[11px] font-semibold text-center leading-tight"
                style={{ color: '#1a140c', letterSpacing: '-0.01em' }}
              >
                {cat.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ============= CatalogHero (events 슬라이더) — page.tsx 가 직접 렌더 ============= */}

      {/* "모든 메뉴" 헤더 — kicker + 큰 헤딩.
          정렬은 SortSelect 가 별도. */}
      <section className="px-4 pb-3 flex items-end justify-between">
        <div>
          <div
            style={{
              fontSize: 11,
              color: '#dc532a',
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            ALL · 전체 {totalCount}개
          </div>
          <h2
            className="font-['Archivo_Black'] mt-1"
            style={{
              fontSize: 26,
              color: '#1a140c',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            모든 메뉴
          </h2>
        </div>
      </section>
    </div>
  )
}
