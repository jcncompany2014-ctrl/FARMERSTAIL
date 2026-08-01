'use client'

/**
 * CountUp — 화면에 들어오면 숫자가 세어 올라간다 (2026-08-01).
 *
 * 랜딩 완성도 업그레이드 프리미티브. "38개 영양소" 같은 숫자가 정적으로 박혀
 * 있으면 장식이지만, 눈앞에서 0→38 로 차오르면 **주장**이 된다.
 *
 * · IntersectionObserver 1회 발화 + rAF ease-out — Reveal 과 같은 철학, 의존성 0.
 * · prefers-reduced-motion 이면 즉시 최종값.
 * · 서버 렌더 시점부터 최종값을 넣어 두므로(초기 state=value) JS 실패·크롤러
 *   환경에서도 숫자는 항상 보인다 — 모션은 보너스지 전제가 아니다.
 */

import { useEffect, useRef, useState } from 'react'

export default function CountUp({
  value,
  duration = 1100,
  suffix = '',
  className,
}: {
  value: number
  /** ms */
  duration?: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration)
          const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
          setShown(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        setShown(0)
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value, duration])

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {shown.toLocaleString()}
      {suffix}
    </span>
  )
}
