'use client'

/**
 * TruckDrive — 1회 주행 구간 (farm v4 Q8 트럭의 여정).
 *
 * 구조: 높이 DRIVE_VH(svh) 섹션 안에 sticky 캔버스(100svh)를 핀.
 * 섹션을 스크롤하는 동안 진행도 p(0~1)를 계산 →
 *   - 배경 레이어: depth 별 다른 속도로 세로 이동(패럴랙스)
 *   - 트럭: 웨이포인트 경로를 따라 좌우 방향 전환하며 단조 증가
 *   - 캡션: 구간 중앙에서 떴다 사라짐
 * 모든 모션은 transform/opacity 만. 스크롤 핸들러 rAF 스로틀.
 * reduced-motion: 리스너 없이 정적 프레임(p=0.5, 트럭이 길 위에 보이는 상태).
 */

import { useEffect, useRef } from 'react'
import { SlotArt } from './PlaceholderArt'
import {
  LAYERS,
  STAGES,
  DRIVE_VH,
  clamp,
  sampleWaypoints,
  captionOpacity,
} from '@/lib/landing/journeyConfig'

export default function TruckDrive({ stage }: { stage: 1 | 2 | 3 }) {
  const cfg = STAGES[stage - 1]
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const truckRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const sticky = stickyRef.current
    const truck = truckRef.current
    const caption = captionRef.current
    if (!section || !sticky || !cfg) return

    const waypoints = cfg.waypoints
    const layerEls = Array.from(
      sticky.querySelectorAll<HTMLElement>('[data-depth]'),
    )

    function apply(p: number) {
      for (const el of layerEls) {
        const travel = Number(el.dataset.travel) || 0
        const depth = Number(el.dataset.depth) || 0
        el.style.transform = `translate3d(0, ${(p * travel).toFixed(2)}px, 0) scale(${(1 + p * 0.05 * depth).toFixed(3)})`
      }
      if (truck && sticky) {
        const cw = sticky.clientWidth
        const ch = sticky.clientHeight
        const wp = sampleWaypoints(waypoints, p)
        const tx = ((wp.x / 100) * cw).toFixed(1)
        const ty = ((wp.y / 100) * ch).toFixed(1)
        truck.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) scale(${wp.s.toFixed(3)}) scaleX(${wp.flip})`
      }
      if (caption) caption.style.opacity = captionOpacity(p).toFixed(3)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      apply(0.5)
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
  }, [cfg])

  return (
    <section
      ref={sectionRef}
      style={{ position: 'relative', height: `${DRIVE_VH}svh` }}
      aria-label={`트럭 주행 ${stage}단계`}
    >
      <div
        ref={stickyRef}
        className="h-screen-s"
        style={{
          position: 'sticky',
          top: 0,
          overflow: 'hidden',
          background:
            'linear-gradient(180deg, #FCF7EA 0%, #F4EBD2 50%, #EFE7CF 100%)',
        }}
      >
        {/* 해 — 살짝 떠 있는 디테일 */}
        <div
          data-depth="0.05"
          data-travel="-8"
          style={{
            position: 'absolute',
            top: '8%',
            right: '14%',
            width: 'clamp(56px, 12vw, 96px)',
            height: 'clamp(56px, 12vw, 96px)',
            willChange: 'transform',
          }}
        >
          <SlotArt slot="A1_1_sun" />
        </div>

        {/* 배경 레이어 (뒤→앞) — 바닥 정렬 풀블리드 */}
        {LAYERS.map((layer) => (
          <div
            key={layer.slot}
            data-depth={layer.depth}
            data-travel={layer.travel}
            style={{
              position: 'absolute',
              inset: 0,
              willChange: 'transform',
            }}
          >
            <SlotArt slot={layer.slot} />
          </div>
        ))}

        {/* 트럭 — 경로 따라 이동/스케일. transform-origin 중심. */}
        <div
          ref={truckRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 'clamp(180px, 42vw, 340px)',
            transformOrigin: 'center',
            willChange: 'transform',
          }}
        >
          <SlotArt slot="T1_truckSide" imgFit="contain" />
        </div>

        {/* 캡션 — TODO(카피): 최종 문구 확정 */}
        <div
          ref={captionRef}
          style={{
            position: 'absolute',
            top: '14%',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 0,
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '8px 18px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.86)',
              fontSize: 'clamp(14px, 3.6vw, 18px)',
              fontWeight: 700,
              color: 'var(--walnut)',
              letterSpacing: '-0.01em',
              boxShadow: '0 8px 22px -10px rgba(61,43,31,0.4)',
            }}
          >
            {cfg?.caption}
          </span>
        </div>
      </div>
    </section>
  )
}
