'use client'

/**
 * CatalogChrome — 모바일 카탈로그 상단 sections (2026-05-21).
 *
 * app-product 핸드오프 디자인 적용:
 *   1. Greeting — "HELLO · 안녕 [강아지]" + "오늘은 뭐 먹을까?" 큰 헤딩
 *   2. Search bar + 검은 filter 버튼 (기존 SearchBar 컴포넌트 활용)
 *   3. Category 5 icon row (화식·토퍼·간식·체험팩·영양제)
 *   4. Hero banner — coral primary + "첫 주문 + 무료배송" + "지금 시작" CTA
 *
 * 데스크톱은 기존 toolbar 그대로 — 본 컴포넌트는 md:hidden.
 */

import Link from 'next/link'
import { Search, Filter, ArrowRight, Gift, ShieldCheck } from 'lucide-react'

interface Category {
  label: string
  href: string
  /** 카테고리 아이콘 (이모지 X, SVG only) */
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  color: string
  /** 새로 추가된 신상품 표시용 dot */
  hasNew?: boolean
}

// 5 카테고리 — 사용자 명시 (이모지 제외) → Lucide 아이콘 매핑
import {
  Soup,
  Cookie,
  Gift as GiftIcon,
  Pill,
  Utensils,
} from 'lucide-react'

const CATEGORIES: Category[] = [
  { label: '화식', href: '/products?category=meal', Icon: Soup, color: '#5d6f3f', hasNew: true },
  { label: '토퍼', href: '/products?category=topper', Icon: Utensils, color: '#e8a82e' },
  { label: '간식', href: '/products?category=treat', Icon: Cookie, color: '#8c3a5f' },
  { label: '체험팩', href: '/products?category=set', Icon: GiftIcon, color: '#dc532a' },
  { label: '영양제', href: '/products?category=supp', Icon: Pill, color: '#3f7fb8' },
]

export default function CatalogChrome({
  dogName,
  totalCount,
}: {
  /** 첫 강아지 이름 (없으면 '보호자') */
  dogName: string
  /** 전체 상품 수 (검색바 placeholder 보조) */
  totalCount: number
}) {
  return (
    <div className="md:hidden">
      {/* Greeting */}
      <section className="px-5 pt-2 pb-4">
        <div
          style={{
            fontSize: 11,
            color: '#dc532a',
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          HELLO · 안녕 {dogName}
        </div>
        <h1
          className="font-['Archivo_Black']"
          style={{
            fontSize: 34,
            color: '#1a140c',
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
          }}
        >
          오늘은
          <br />
          뭐 먹을까?
        </h1>
      </section>

      {/* Search */}
      <section className="px-5 pb-4">
        <Link
          href="/search"
          className="flex items-center gap-2.5 px-4 py-3 bg-white"
          style={{
            borderRadius: 18,
            boxShadow: '0 2px 8px rgba(26,20,12,0.04)',
          }}
        >
          <Search size={18} color="#7a6d5b" strokeWidth={1.8} />
          <span
            className="flex-1 text-[13px]"
            style={{ color: '#7a6d5b' }}
          >
            제품 · 단백질 · 알러지 검색
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
      <section className="px-4 pb-5">
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
                  borderRadius: 18,
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(26,20,12,0.06)',
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
                className="text-[11px] font-semibold"
                style={{ color: '#1a140c', letterSpacing: '-0.01em' }}
              >
                {cat.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Hero banner — 첫 주문 50% off */}
      <section className="px-4 pb-5">
        <Link
          href="/products?sort=best"
          className="relative block overflow-hidden"
          style={{
            background: '#dc532a',
            borderRadius: 28,
            padding: '20px 22px',
            color: '#fff',
          }}
        >
          {/* 장식 원 */}
          <span
            className="absolute pointer-events-none"
            style={{
              top: -50,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.14)',
            }}
          />
          <span
            className="absolute pointer-events-none"
            style={{
              bottom: -80,
              right: -40,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.07)',
            }}
          />
          {/* 선물 아이콘 (이모지 X) */}
          <span
            className="absolute pointer-events-none"
            style={{ top: 26, right: 30, color: 'rgba(255,255,255,0.28)' }}
          >
            <Gift size={64} strokeWidth={1.8} />
          </span>

          <div className="relative">
            <span
              className="inline-flex items-center font-bold"
              style={{
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.22)',
                borderRadius: 10,
                fontSize: 10,
                letterSpacing: 1.5,
              }}
            >
              NEW · 첫구매 한정
            </span>
            <div
              className="font-['Archivo_Black'] mt-3.5 flex items-center gap-2"
              style={{
                fontSize: 30,
                lineHeight: 0.95,
                letterSpacing: '-0.025em',
              }}
            >
              <span>
                첫 주문
                <br />+ 무료배송
              </span>
              <span style={{ marginTop: 12 }}>
                <ShieldCheck size={28} color="#fff" strokeWidth={2} />
              </span>
            </div>
            <p
              className="mt-2.5"
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.88)',
                lineHeight: 1.4,
              }}
            >
              지금 시작하면 체험팩 50% 할인
              <br />+ 다음 주문 1,000P 적립
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <span
                className="inline-flex items-center gap-1.5 font-bold"
                style={{
                  padding: '10px 18px',
                  background: '#fff',
                  color: '#dc532a',
                  borderRadius: 14,
                  fontSize: 13,
                }}
              >
                지금 시작
                <ArrowRight size={14} color="#dc532a" strokeWidth={2} />
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                D−5
              </span>
            </div>
          </div>
          {/* 도트 페이지네이션 (장식) */}
          <div
            className="absolute flex gap-1"
            style={{ bottom: 14, right: 18 }}
          >
            <span style={{ width: 14, height: 5, borderRadius: 3, background: '#fff' }} />
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.45)' }} />
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.45)' }} />
          </div>
        </Link>
      </section>

      {/* 모든 메뉴 헤더 — kicker + 큰 헤딩 + 정렬 라벨 (정렬은 SortSelect 가 별도 표시) */}
      <section className="px-5 pb-3 flex items-end justify-between">
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
