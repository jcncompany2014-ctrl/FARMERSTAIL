'use client'

/**
 * Parallax — 스크롤과 다른 속도로 움직여 깊이를 만든다 (2026-08-01).
 *
 * 랜딩 완성도 업그레이드(사장님 "AI 티 안 나게")의 프리미티브. 사진·장식이
 * 스크롤에 1:1 로 딸려 가는 것이 평면적 인상의 큰 원인이다 — 배경이 살짝
 * 느리게(speed<0) 또는 빠르게(speed>0) 움직이면 층이 생긴다.
 *
 * # 구현 원칙 (라이브러리 없음 — Reveal 과 같은 철학)
 * · rAF 로 스로틀 — scroll 이벤트마다 계산하지 않는다.
 * · IntersectionObserver 로 화면 밖이면 아예 계산하지 않는다.
 * · transform 만 만진다(레이아웃 무영향). will-change 로 컴포지터 레이어.
 * · prefers-reduced-motion 이면 정적 — 아무것도 안 한다.
 * · 이동량은 뷰포트 중심 대비 오프셋 × speed. 과하면 멀미 — 0.06~0.18 권장.
 */

import { useEffect, useRef } from 'react'

export default function Parallax({
  children,
  speed = 0.12,
  className,
}: {
  children: React.ReactNode
  /** 양수 = 스크롤 방향으로 더 밀림(전경), 음수 = 덜 밀림(배경). 0.06~0.18 권장. */
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let visible = false
    let raf = 0

    const update = () => {
      raf = 0
      if (!visible) return
      const rect = el.getBoundingClientRect()
      // 요소 중심이 뷰포트 중심에서 얼마나 떨어졌나 (-1 ~ 1 근방).
      const mid = rect.top + rect.height / 2 - window.innerHeight / 2
      el.style.transform = `translate3d(0, ${(mid * speed).toFixed(1)}px, 0)`
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting)
        if (visible) onScroll()
      },
      { rootMargin: '20% 0px 20% 0px' },
    )
    io.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [speed])

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  )
}
