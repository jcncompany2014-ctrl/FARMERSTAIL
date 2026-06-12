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
}: {
  children: React.ReactNode
  /** transition-delay (ms) — 카드 stagger 용 */
  delay?: number
  className?: string
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

  return (
    <div
      ref={ref}
      className={`fv-reveal${inView ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
