/**
 * BrandWordmark — v3 "FARMER'S TAIL." 로고 word-mark.
 *
 * 2줄 sans 900 + 마지막 `.` 만 accent color. 사용자 요청에 따라 Serif italic
 * 폐기 — 마침표는 sans 그대로, 색상만 accent 로 강조.
 *
 * @example 상단 헤더 — 22px
 *   <BrandWordmark size={22} />
 *
 * @example 풋터 / hero — 38px
 *   <BrandWordmark size={38} />
 */

import { V3 } from '@/lib/design/tokens'

interface BrandWordmarkProps {
  /** 폰트 사이즈 (px). 기본 22 (top bar). */
  size?: number
  /** color override — 기본 ink. 검정 카드 위에 쓸 때 'paper' 등으로. */
  color?: string
  /** 강조 accent color — 마지막 `.` 색. 기본 v3 accent. */
  accentColor?: string
  className?: string
  style?: React.CSSProperties
}

export default function BrandWordmark({
  size = 22,
  color = V3.ink,
  accentColor = V3.accent,
  className,
  style,
}: BrandWordmarkProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-sans)',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        color,
        ...style,
      }}
      aria-label="Farmer's Tail"
    >
      FARMER&rsquo;S
      <br />
      TAIL
      <span style={{ color: accentColor }} aria-hidden>
        .
      </span>
    </span>
  )
}
