import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Clock } from 'lucide-react'
import RecentlyViewed from '@/components/products/RecentlyViewed'

/**
 * /history — 최근 본 상품 전체 보기.
 *
 * PDP 하단 RecentlyViewed strip 의 "전체 보기" 링크 / 헤더 메뉴에서 진입.
 * localStorage 기반이라 디바이스/브라우저당 분리. 비로그인도 사용 가능.
 */

export const metadata: Metadata = {
  title: '최근 본 상품 | 파머스테일',
  description: '최근에 살펴본 상품을 한 곳에 모았어요.',
  alternates: { canonical: '/history' },
  robots: { index: false, follow: true },
}

export default function HistoryPage() {
  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            최근 본 상품
          </span>
        </nav>
      </div>

      <section className="px-5 md:px-8 pt-6 md:pt-12 pb-6 md:pb-10">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase inline-flex items-center gap-1.5"
          style={{ color: 'var(--terracotta)' }}
        >
          <Clock className="w-3 h-3" strokeWidth={2.25} />
          History · 최근 본
        </span>
        <h1
          className="font-serif mt-2 md:mt-3 text-[24px] md:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
          }}
        >
          최근 본 상품
        </h1>
        <p
          className="mt-2 md:mt-3 text-[12px] md:text-[14px]"
          style={{ color: 'var(--muted)' }}
        >
          이 디바이스에서 최근에 살펴본 상품들이에요. 다른 디바이스에서는 따로
          기록돼요.
        </p>
      </section>

      <section className="px-5 md:px-8">
        <RecentlyViewed title="" />
      </section>

      <section className="px-5 md:px-8 mt-10 md:mt-16 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-5 md:px-7 py-2.5 md:py-3 rounded-full text-[12.5px] md:text-[14px] font-bold transition active:scale-[0.97]"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          전체 카탈로그 둘러보기
        </Link>
      </section>
    </main>
  )
}
