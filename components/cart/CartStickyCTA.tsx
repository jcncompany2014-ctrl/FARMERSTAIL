'use client'

/**
 * CartStickyCTA — 모바일 cart 하단 dual-pane 결제 pill (2026-05-21 r2).
 *
 * 핸드오프 패턴: dual-pane pill.
 *   좌측  : "N개 · 합계" kicker + 큰 금액
 *   우측  : "결제하기 →" (font-bold, arrow)
 *   사이  : vertical hairline divider
 *
 * # 스크롤 reveal
 *  - 초기 상태 = BottomNav 보임, CTA 숨김.
 *  - 스크롤 down → CTA가 BottomNav 자리로 슬라이드 인 (body.cart-cta-active
 *    클래스 → globals.css 가 BottomNav 를 translateY(100%) 로 밀어냄).
 *  - 스크롤 up → CTA 사라지고 BottomNav 복귀.
 *  - 페이지 상단 40px 이내는 무조건 nav 모드 (CTA 안 띄움).
 *  - 8px 임계 hysteresis 로 jitter 방지.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Mode = 'nav' | 'cta'

export default function CartStickyCTA({
  count,
  total,
}: {
  count: number
  total: number
}) {
  const [mode, setMode] = useState<Mode>('nav')

  useEffect(() => {
    let lastY = window.scrollY
    let lastDir: 'up' | 'down' | null = null
    let pending = false

    function onScroll() {
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY

        // 상단 근접 — 항상 nav 모드.
        if (y < 40) {
          if (lastDir !== 'up') {
            setMode('nav')
            lastDir = 'up'
          }
          lastY = y
          pending = false
          return
        }

        // 방향 전환은 8px 누적 후에만 확정 (jitter 방지).
        if (Math.abs(delta) > 8) {
          const dir: 'up' | 'down' = delta > 0 ? 'down' : 'up'
          if (dir !== lastDir) {
            setMode(dir === 'down' ? 'cta' : 'nav')
            lastDir = dir
          }
          lastY = y
        }
        pending = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // body 클래스 동기화 — globals.css 의 [data-cart-bottom-nav] 규칙이 nav 를 슬라이드 아웃.
  useEffect(() => {
    if (mode === 'cta') {
      document.body.classList.add('cart-cta-active')
    } else {
      document.body.classList.remove('cart-cta-active')
    }
    return () => document.body.classList.remove('cart-cta-active')
  }, [mode])

  const visible = mode === 'cta'

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-50"
      style={{
        bottom: 0,
        paddingTop: 10,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        background:
          'linear-gradient(to top, #fbf3df 70%, rgba(251,243,223,0))',
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
        transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      aria-hidden={!visible}
    >
      <div className="px-3 max-w-md mx-auto">
        <Link
          href="/checkout"
          className="flex items-center transition active:scale-[0.99]"
          style={{
            height: 54,
            borderRadius: 27,
            background: '#dc532a',
            color: '#fff',
            boxShadow: '0 12px 26px rgba(220,83,42,0.4)',
          }}
        >
          {/* 좌측 — 금액. 폭 fit-content, padding 14/12 */}
          <div
            className="shrink-0 flex flex-col"
            style={{ paddingLeft: 18, paddingRight: 12 }}
          >
            <span
              style={{
                fontSize: 9.5,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 0.6,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              {count}개 · 합계
            </span>
            <span
              className="font-['Archivo_Black'] tabular-nums"
              style={{
                fontSize: 17,
                lineHeight: 1.05,
                color: '#fff',
                letterSpacing: '-0.015em',
                whiteSpace: 'nowrap',
              }}
            >
              {total.toLocaleString()}원
            </span>
          </div>

          {/* Divider — 더 진하게, 좌우 padding 사이에 한 줄 */}
          <span
            className="shrink-0"
            style={{
              width: 1,
              height: 28,
              background: 'rgba(255,255,255,0.32)',
            }}
          />

          {/* 우측 — 결제하기. flex-1, padding 양쪽 14/16 */}
          <span
            className="font-['Archivo_Black'] flex-1 flex items-center justify-center gap-1.5"
            style={{
              paddingLeft: 12,
              paddingRight: 16,
              fontSize: 14.5,
              letterSpacing: '0.005em',
            }}
          >
            결제하기
            <ArrowRight size={16} color="#fff" strokeWidth={2.4} />
          </span>
        </Link>
      </div>
    </div>
  )
}
