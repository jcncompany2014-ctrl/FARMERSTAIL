/**
 * Scribble — 크레용 손그림 낙서 세트 (farm v4 Q6, 2026-06-12).
 *
 * 사장님 결정 B: "제목은 단정한 고딕, 귀여움은 손그림 낙서가 담당"
 * (nuffjuice 공식 — 그쪽도 본문은 Inter, 매력은 doodle 그래픽).
 *
 * feTurbulence + feDisplacementMap 필터로 매끈한 SVG 패스를 크레용처럼
 * 울퉁불퉁하게 만든다. 서버 컴포넌트 — JS 비용 0.
 *
 * 색은 브랜드 토큰 계열만: moss(#6B7F3A) / terracotta(#D85A30 계열).
 */

import { useId } from 'react'

/** useId 는 ':' 를 포함 — SVG url(#...) 참조에서 깨질 수 있어 정리. */
function cleanId(raw: string, prefix: string) {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

function RoughFilter({ id, scale = 2.8 }: { id: string; scale?: number }) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.16"
        numOctaves="2"
        result="n"
      />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} />
    </filter>
  )
}

/** 단어 강조 밑줄 — <ScribbleUnderline>진짜</ScribbleUnderline> */
export function ScribbleUnderline({
  children,
  color = '#C75B33',
}: {
  children: React.ReactNode
  color?: string
}) {
  const id = cleanId(useId(), 'scrul')
  return (
    <span className="relative inline-block">
      {children}
      <svg
        viewBox="0 0 120 22"
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: '-5%',
          bottom: '-0.28em',
          width: '110%',
          height: '0.42em',
        }}
        preserveAspectRatio="none"
      >
        <defs>
          <RoughFilter id={id} scale={1.4} />
        </defs>
        <path
          d="M6 14 Q 60 8 114 13"
          stroke={color}
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${id})`}
          opacity="0.85"
        />
      </svg>
    </span>
  )
}

/** 손그림 화살표 — 완만한 곡선 + 화살촉. rotate 로 방향 조절. */
export function ScribbleArrow({
  color = '#6B7F3A',
  width = 64,
  rotate = 0,
  className,
}: {
  color?: string
  width?: number
  rotate?: number
  className?: string
}) {
  const id = cleanId(useId(), 'scrar')
  return (
    <svg
      viewBox="0 0 90 60"
      aria-hidden
      className={className}
      style={{
        width,
        height: (width * 60) / 90,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      <defs>
        <RoughFilter id={id} />
      </defs>
      <path
        d="M8 38 Q 42 32 70 24 M70 24 l-15 -1 M70 24 l-4 13"
        stroke={color}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id})`}
      />
    </svg>
  )
}

/** 크레용 블롭 숫자 — 단계 표시용 (레퍼런스: 손그림 1→2→3). */
export function ScribbleBlobNum({
  n,
  size = 44,
  color = '#5D7A45',
}: {
  n: string | number
  size?: number
  color?: string
}) {
  const id = cleanId(useId(), 'scrbl')
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 60 60" aria-hidden className="absolute inset-0 w-full h-full">
        <defs>
          <RoughFilter id={id} scale={3.4} />
        </defs>
        <path
          d="M30 4 C 45 2 56 12 56 28 C 57 45 47 57 30 56 C 13 57 4 46 4 29 C 4 13 14 5 30 4 Z"
          fill={color}
          filter={`url(#${id})`}
        />
        {/* 하이라이트 한 획 — 크레용 덧칠 느낌 */}
        <path
          d="M14 14 Q 22 7 33 8"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${id})`}
        />
      </svg>
      <span
        className="relative"
        style={{
          color: '#FFFEFA',
          fontWeight: 800,
          fontSize: size * 0.42,
          lineHeight: 1,
        }}
      >
        {n}
      </span>
    </span>
  )
}
