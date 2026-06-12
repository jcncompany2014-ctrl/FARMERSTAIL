'use client'

/**
 * FarmHorizon — 농장 지평선 일러스트 + 스크롤 패럴럭스 (farm v4 Q4-Q5).
 *
 * 동화책 톤의 겹친 언덕 3단 + 해 + 나무 + 새. 스크롤하면 층마다 다른 속도로
 * 움직여 깊이감을 만든다 (nuffjuice/Framer 류의 parallax — 라이브러리 없이
 * rAF 1개). prefers-reduced-motion 이면 정지 일러스트로만.
 *
 * 일러스트 = 세계관, 실사 = 음식 — 합의된 farm v4 규칙. 실사진이 들어와도
 * 이 레이어는 브랜드 시그니처로 유지.
 */

import { useEffect, useRef } from 'react'

export default function FarmHorizon() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const vh = window.innerHeight
        // 요소가 뷰포트 하단에 등장(0) → 상단으로 빠져나감(1)
        const p = Math.min(1, Math.max(0, 1 - (r.bottom - 0) / (vh + r.height)))
        el.style.setProperty('--fv-p', p.toFixed(4))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height: 'clamp(150px, 24vw, 260px)' }}
    >
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* 해 — 스크롤하면 살짝 떠오른다. (모바일 가시영역 x≈345~1095 안쪽 배치) */}
        <g
          style={{
            transform: 'translateY(calc(var(--fv-p, 0) * -26px))',
          }}
        >
          <circle cx="995" cy="92" r="44" fill="#E9C46A" />
          <circle cx="995" cy="92" r="62" fill="#E9C46A" opacity="0.18" />
        </g>
        {/* 새 — 해보다 미세하게 더 떠오름 */}
        <g
          style={{
            transform: 'translateY(calc(var(--fv-p, 0) * -34px))',
          }}
        >
          <path
            d="M505 96 q9 -9 18 0 q9 -9 18 0"
            stroke="#9C8F77"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M575 68 q7 -7 14 0 q7 -7 14 0"
            stroke="#9C8F77"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        {/* 뒷 언덕 + 나무 — 천천히 가라앉음 (깊이감의 핵심) */}
        <g style={{ transform: 'translateY(calc(var(--fv-p, 0) * 14px))' }}>
          <path
            d="M0 190 Q 300 110 640 170 T 1440 150 V 300 H 0 Z"
            fill="#DFE5C6"
          />
          <rect x="922" y="140" width="7" height="26" rx="3" fill="#7A6A4F" />
          <circle cx="925.5" cy="124" r="26" fill="#A9BC81" />
          <rect x="982" y="152" width="5" height="18" rx="2.5" fill="#7A6A4F" />
          <circle cx="984.5" cy="142" r="17" fill="#B5C48F" />
        </g>
        {/* 중간 언덕 */}
        <g style={{ transform: 'translateY(calc(var(--fv-p, 0) * 7px))' }}>
          <path
            d="M0 235 Q 380 160 800 225 T 1440 210 V 300 H 0 Z"
            fill="#C5D1A4"
          />
        </g>
        {/* 앞 언덕 — 고정 (기준면) */}
        <path
          d="M0 282 Q 460 222 940 272 T 1440 258 V 300 H 0 Z"
          fill="#A9BC81"
        />
      </svg>
    </div>
  )
}
