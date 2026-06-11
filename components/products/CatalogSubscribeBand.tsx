'use client'

/**
 * CatalogSubscribeBand — sage 그린 큰 정기배송 배너 (2026-05-21).
 *
 * app-product 핸드오프 CPSubscribeBand 패턴.
 * 카탈로그 그리드 다음 또는 마지막에 표시.
 */

import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'

export default function CatalogSubscribeBand({
  variant = 'web',
}: {
  /** 'web' (기본) 또는 'app' — v3 톤 분기 (R14 cleanup) */
  variant?: 'web' | 'app'
} = {}) {
  const isApp = variant === 'app'
  return (
    <section className="px-4 mt-6 md:hidden">
      <Link
        href="/products?subscribable=1"
        className="relative flex items-center gap-3.5 overflow-hidden"
        style={{
          background: '#5d6f3f',
          // Phase P: off-token 8 → md tier 12 (hero 카드 그래머 정합)
          borderRadius: isApp ? 12 : 24,
          padding: 16,
          color: '#fff',
        }}
      >
        {/* 장식 원 */}
        <span
          className="absolute pointer-events-none"
          style={{
            right: -30,
            top: -30,
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.13)',
          }}
        />
        {/* 좌측 캘린더 아이콘 */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: 56,
            height: 56,
            borderRadius: isApp ? 4 : 18,
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
          }}
        >
          <Calendar size={28} color="#fff" strokeWidth={1.8} />
        </span>
        {/* 카피 */}
        <div className="relative flex-1 min-w-0">
          <div
            className="font-bold"
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.8)',
              letterSpacing: 1,
            }}
          >
            SUBSCRIBE · 정기배송
          </div>
          <div
            className={isApp ? 'mt-0.5' : "font-['Archivo_Black'] mt-0.5"}
            style={{
              fontSize: 16,
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              fontFamily: isApp ? "var(--font-sans), 'Pretendard', sans-serif" : undefined,
              fontWeight: isApp ? 900 : undefined,
            }}
          >
            2주마다 자동 배송 + 10% 할인
          </div>
          <div
            className="mt-1"
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            언제든 일시정지·해지 가능
          </div>
        </div>
        {/* 우측 화살표 원 */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: '#fff',
            color: '#5d6f3f',
          }}
        >
          <ChevronRight size={18} color="#5d6f3f" strokeWidth={2.4} />
        </span>
      </Link>
    </section>
  )
}
