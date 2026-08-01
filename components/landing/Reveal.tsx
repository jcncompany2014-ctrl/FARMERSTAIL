'use client'

/**
 * Reveal — 스크롤 등장 모션 (farm v4 Q5, 2026-06-12).
 *
 * 뷰포트에 들어오면 한 번 아래→위로 떠오른다 (nuffjuice/Framer 톤의
 * appear 효과). IntersectionObserver 1개 — 라이브러리 의존성 없음.
 * prefers-reduced-motion 이면 즉시 표시.
 * 스타일은 globals.css 의 .fv-reveal / .is-in 이 담당.
 */

import { useEffect, useRef, useState } from 'react'

export default function Reveal({
  children,
  delay = 0,
  className,
  variant = 'up',
}: {
  children: React.ReactNode
  /** transition-delay (ms) — 카드 stagger 용 */
  delay?: number
  className?: string
  /**
   * 등장 방향 (2026-08-01). 전부 'up' 하나였던 것이 12개 섹션을 같은 리듬으로
   * 만들어 "AI 티"의 원인이었다(사장님). 섹션 구도에 맞는 방향을 고른다 —
   * 좌우 배치는 left/right, 사진·카드 강조는 scale.
   */
  variant?: 'up' | 'left' | 'right' | 'scale'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // reduced-motion 은 globals.css 의 @media 규칙이 즉시 표시 처리 — JS 불필요.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const base =
    variant === 'up' ? 'fv-reveal' : `fv-reveal-${variant}`
  return (
    <div
      ref={ref}
      className={`${base}${inView ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
