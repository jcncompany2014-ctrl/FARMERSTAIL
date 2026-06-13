'use client'

/**
 * TruckArrival — 트럭 여정의 클라이맥스 (farm v4 Q8).
 * 정면 트럭(T3)이 아래에서 솟아오르며 커지고, 마중 나온 강아지(B1)가
 * 왼쪽에서 달려 들어온다. 진행도 p 로 transform/opacity 만 제어.
 * reduced-motion: 정적 도착 상태(p=1).
 */

import { useEffect, useRef } from 'react'
import { SlotArt } from './PlaceholderArt'
import { ARRIVAL, ARRIVAL_VH, clamp } from '@/lib/landing/journeyConfig'

export default function TruckArrival() {
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const truckRef = useRef<HTMLDivElement>(null)
  const dogRef = useRef<HTMLDivElement>(null)
  const capRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const sticky = stickyRef.current
    const truck = truckRef.current
    const dog = dogRef.current
    const cap = capRef.current
    if (!section || !sticky) return

    function apply(p: number) {
      if (truck) {
        const rise = (1 - clamp(p / 0.6)) * 28 // 아래→제자리 (vh)
        const scale = 0.62 + clamp(p / 0.6) * 0.46 // 0.62→1.08
        truck.style.transform = `translate3d(-50%, ${rise.toFixed(2)}svh, 0) scale(${scale.toFixed(3)})`
        truck.style.opacity = clamp(p / 0.3).toFixed(3)
      }
      if (dog) {
        const dp = clamp((p - 0.35) / 0.45)
        const x = -60 + dp * 50 // -60% → -10% (트럭 앞으로 달려옴)
        dog.style.transform = `translate3d(${x.toFixed(1)}%, 0, 0)`
        dog.style.opacity = dp.toFixed(3)
      }
      if (cap) cap.style.opacity = clamp((p - 0.55) / 0.25).toFixed(3)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      apply(1)
      return
    }

    let raf = 0
    function onScroll() {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!section || !sticky) return
        const rect = section.getBoundingClientRect()
        const pin = section.offsetHeight - sticky.offsetHeight
        const p = pin > 0 ? clamp(-rect.top / pin) : 0
        apply(p)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      style={{ position: 'relative', height: `${ARRIVAL_VH}svh` }}
      aria-label="트럭 도착"
    >
      <div
        ref={stickyRef}
        className="h-screen-s"
        style={{
          position: 'sticky',
          top: 0,
          overflow: 'hidden',
          background:
            'linear-gradient(180deg, #FCF7EA 0%, #F0E7CE 55%, #E7DCC0 100%)',
        }}
      >
        {/* 바닥 풀밭 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '34%',
            background: 'linear-gradient(180deg, #8FA64E 0%, #7C9442 100%)',
          }}
        />

        {/* 정면 트럭 */}
        <div
          ref={truckRef}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '8%',
            width: 'clamp(260px, 78vw, 520px)',
            transformOrigin: 'center bottom',
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          <SlotArt slot="T3_truckFront" imgFit="contain" />
        </div>

        {/* 마중 나온 강아지 */}
        <div
          ref={dogRef}
          style={{
            position: 'absolute',
            left: '12%',
            bottom: '6%',
            width: 'clamp(120px, 30vw, 210px)',
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          <SlotArt slot="B1_dog" imgFit="contain" />
        </div>

        {/* 캡션 — TODO(카피) */}
        <div
          ref={capRef}
          style={{
            position: 'absolute',
            top: '12%',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '8px 18px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.88)',
              fontSize: 'clamp(15px, 4vw, 20px)',
              fontWeight: 700,
              color: 'var(--walnut)',
              boxShadow: '0 8px 22px -10px rgba(61,43,31,0.4)',
            }}
          >
            {ARRIVAL.caption}
          </span>
        </div>
      </div>
    </section>
  )
}
