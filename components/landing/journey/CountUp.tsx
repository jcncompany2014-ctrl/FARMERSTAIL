'use client'

/**
 * CountUp — 뷰포트 진입 시 0→target 카운트업 (1회). farm v4 Q9 콘텐츠2.
 * reduced-motion 이면 즉시 목표값. 모션은 숫자 텍스트만 바뀌므로 layout 안전.
 */

import { useEffect, useRef, useState } from 'react'

export default function CountUp({
  to,
  durationMs = 1300,
  suffix = '',
  className,
  style,
}: {
  to: number
  durationMs?: number
  suffix?: string
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      // setState 동기 호출 회피 — rAF 로 비동기 스케줄.
      const r = requestAnimationFrame(() => setVal(to))
      return () => cancelAnimationFrame(r)
    }
    let started = false
    let raf = 0
    let t0 = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          started = true
          io.disconnect()
          const step = (t: number) => {
            if (!t0) t0 = t
            const p = Math.min(1, (t - t0) / durationMs)
            const ease = 1 - Math.pow(1 - p, 3)
            setVal(Math.round(to * ease))
            if (p < 1) raf = requestAnimationFrame(step)
          }
          raf = requestAnimationFrame(step)
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [to, durationMs])

  return (
    <span ref={ref} className={className} style={style}>
      {val}
      {suffix}
    </span>
  )
}
