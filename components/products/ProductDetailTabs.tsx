'use client'

import { useEffect, useState } from 'react'

/**
 * ProductDetailTabs — PDP 의 sticky 탭 네비.
 *
 * 마켓컬리/SSF 의 PDP 표준: 메인 정보 아래에 sticky 한 탭 (상품설명 / 상세정보 /
 * 후기 / 문의) 이 떠 있고 클릭하면 해당 anchor 로 부드럽게 스크롤. 사용자가
 * 페이지를 스크롤하면 현재 보이는 섹션이 활성으로 underline 된다.
 *
 * 구현:
 *   • IntersectionObserver 로 각 섹션을 추적
 *   • Header(64px) + 자체 높이(48px) 만큼 anchor offset 보정
 *   • mobile / desktop 동일 동작
 */

export type PdpTab = {
  id: string
  label: string
  count?: number
}

/**
 * scroll-anchor offset 은 mount 후 root --ft-chrome-h 를 읽어 동적으로 산출.
 * fallback 은 mobile WebChrome 기본 (160) + tab bar (48).
 */
const FALLBACK_HEADER_OFFSET = 160 + 48

export default function ProductDetailTabs({ tabs }: { tabs: PdpTab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? '')

  function readHeaderOffset(): number {
    if (typeof window === 'undefined') return FALLBACK_HEADER_OFFSET
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--ft-chrome-h')
      .trim()
    const n = parseInt(v, 10)
    if (!Number.isFinite(n)) return FALLBACK_HEADER_OFFSET
    return n + 48 // + tab bar
  }

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el)
    if (sections.length === 0) return

    const offset = readHeaderOffset()
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0 && visible[0].target.id) {
          setActive(visible[0].target.id)
        }
      },
      {
        rootMargin: `-${offset + 8}px 0px -60% 0px`,
        threshold: 0,
      },
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [tabs])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const offset = readHeaderOffset()
    const y = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActive(id)
  }

  return (
    <nav
      className="ft-sticky-under-chrome z-20 border-b border-t"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--rule)',
      }}
      aria-label="섹션 탐색"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="flex">
          {tabs.map((t) => {
            const isActive = active === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => scrollTo(t.id)}
                className="relative flex-1 md:flex-initial md:px-7 py-3 text-[13px] md:text-[14px] font-bold transition"
                style={{
                  color: isActive ? 'var(--ink)' : 'var(--muted)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t.label}
                {typeof t.count === 'number' && t.count > 0 && (
                  <span
                    className="ml-1 tabular-nums"
                    style={{ color: 'var(--terracotta)' }}
                  >
                    {t.count > 999 ? '999+' : t.count}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-px h-[2px]"
                    style={{ background: 'var(--ink)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
