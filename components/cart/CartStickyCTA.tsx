'use client'

/**
 * CartStickyCTA — 모바일 cart 하단 고정 결제 버튼 (2026-05-21).
 *
 * 핸드오프 패턴: dual-pane pill.
 *   좌측  : "N개 · 합계" kicker + 큰 금액
 *   우측  : "결제하기 →" (font-bold, arrow)
 *   사이  : vertical hairline divider
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CartStickyCTA({
  count,
  total,
}: {
  count: number
  total: number
}) {
  return (
    <div
      className="md:hidden fixed left-0 right-0 z-30"
      style={{
        bottom: 0,
        background: 'linear-gradient(to top, #fbf3df 75%, rgba(251,243,223,0))',
        paddingTop: 12,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
      }}
    >
      <div className="px-4 max-w-md mx-auto">
        <Link
          href="/checkout"
          className="flex items-center transition active:scale-[0.99]"
          style={{
            height: 56,
            borderRadius: 28,
            background: '#dc532a',
            color: '#fff',
            boxShadow: '0 12px 26px rgba(220,83,42,0.4)',
            paddingRight: 18,
          }}
        >
          <div
            className="flex flex-col shrink-0"
            style={{ padding: '0 18px' }}
          >
            <span
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 1,
              }}
            >
              {count}개 · 합계
            </span>
            <span
              className="font-['Archivo_Black']"
              style={{
                fontSize: 16,
                lineHeight: 1,
                color: '#fff',
              }}
            >
              {total.toLocaleString()}원
            </span>
          </div>
          <span
            style={{
              width: 1,
              height: 30,
              background: 'rgba(255,255,255,0.3)',
              flexShrink: 0,
            }}
          />
          <span
            className="font-['Archivo_Black'] flex-1 flex items-center justify-center gap-1.5"
            style={{
              fontSize: 14,
              letterSpacing: '0.02em',
            }}
          >
            결제하기
            <ArrowRight size={16} color="#fff" strokeWidth={2.2} />
          </span>
        </Link>
      </div>
    </div>
  )
}
