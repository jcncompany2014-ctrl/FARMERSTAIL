'use client'

/**
 * CartStickyCTA — 모바일 cart 하단 dual-pane 결제 pill (2026-05-21 r2).
 *
 * 핸드오프 패턴: dual-pane pill.
 *   좌측  : "N개 · 합계" kicker + 큰 금액
 *   우측  : "결제하기 →" (font-bold, arrow)
 *   사이  : vertical hairline divider
 *
 * # 스크롤 reveal (R22 — 사용자 요청: CTA 쪽으로 유리하게)
 *  - 초기 상태 = CTA 보임 (즉시 결제 가능 — 모바일 commerce UX 표준).
 *  - 스크롤 up (위로 올림, 메뉴 보고 싶을 때) → nav 복귀.
 *  - 스크롤 down (아래 — 더 보거나 결제 직전) → CTA 유지.
 *  - 페이지 바닥에서 살짝 위로 끌어올려도 CTA 유지 (사용자 보고: 끝까지
 *    내리면 갑자기 사라지는 버그 — bounce / overscroll 무시).
 *  - 14px 임계 hysteresis — up 으로 명확히 끌어올릴 때만 nav.
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
  // R22: default 'cta' — 모바일 commerce 표준 (즉시 결제 가능).
  const [mode, setMode] = useState<Mode>('cta')

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
        // 페이지 바닥 근접 (overscroll bounce 영역). CTA 유지 — 사용자 보고:
        // 끝까지 내릴 때 갑자기 사라지던 버그 차단.
        const docHeight = document.documentElement.scrollHeight
        const winHeight = window.innerHeight
        const nearBottom = y + winHeight >= docHeight - 80

        if (nearBottom) {
          if (lastDir !== 'down') {
            setMode('cta')
            lastDir = 'down'
          }
          lastY = y
          pending = false
          return
        }

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

        // 방향 전환 — up 으로 명확히 끌어올릴 때만 nav, 그 외엔 CTA 유지
        // (사용자 요청: CTA 쪽으로 유리). hysteresis 14px — down 은 4px 만으로
        // CTA 진입, up 은 14px 확실히 올린 후만 nav.
        if (delta > 4) {
          // 아래로 — CTA
          if (lastDir !== 'down') {
            setMode('cta')
            lastDir = 'down'
          }
          lastY = y
        } else if (delta < -14) {
          // 위로 (충분히 올림) — nav
          if (lastDir !== 'up') {
            setMode('nav')
            lastDir = 'up'
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
            height: 58,
            borderRadius: 29,
            background: '#dc532a',
            color: '#fff',
            // R22: 시인성 강화 — shadow 더 진하게 + accent 발광.
            boxShadow:
              '0 16px 36px rgba(220,83,42,0.48), 0 4px 12px rgba(220,83,42,0.28), inset 0 1px 0 rgba(255,255,255,0.22)',
            border: '1px solid rgba(178, 58, 26, 0.6)',
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
