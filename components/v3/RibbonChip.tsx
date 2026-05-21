/**
 * RibbonChip — v3 의 작은 ribbon 라벨 (FAMILY · №01 / SINCE · '23·09).
 *
 * 2줄 구조: 위 Mono kicker (xxs / uppercase / 1.6 letter-spacing), 아래 sans
 * bold 14. 기본 ink bg + paperHi text. tone prop 으로 accent / sage / yellow
 * 등 다른 톤도 가능.
 *
 * 강아지 detail hero 좌측 하단의 ribbon overlay / journal date pillar 등
 * 매거진 톤 라벨 전반에 재사용.
 *
 * @example FAMILY 라벨
 *   <RibbonChip kicker="FAMILY" value="№01" />
 *
 * @example 날짜 pillar (Journal)
 *   <RibbonChip kicker="MAY" value="20" tone="ink" />
 */

import { V3, V3FontSize, V3FontWeight } from '@/lib/design/tokens'
import Mono from './Mono'

type Tone = 'ink' | 'paper' | 'accent' | 'sage' | 'yellow'

interface RibbonChipProps {
  /** Mono kicker 라벨 (위쪽 ALL CAPS). */
  kicker: string
  /** 큰 값 (아래쪽 sans bold). */
  value: React.ReactNode
  /** tone — bg + text 색 자동 조합. 기본 'ink' (검정 bg + paperHi text). */
  tone?: Tone
  /** size — 'sm' (14px value) / 'md' (18px) / 'lg' (24px). 기본 'sm'. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

const TONE_BG: Record<Tone, string> = {
  ink: V3.ink,
  paper: V3.paperHi,
  accent: V3.accent,
  sage: V3.sage,
  yellow: V3.yellow,
}

const TONE_FG: Record<Tone, string> = {
  ink: V3.paperHi,
  paper: V3.ink,
  accent: V3.paperHi,
  sage: V3.paperHi,
  yellow: V3.ink,
}

const VALUE_SIZE: Record<NonNullable<RibbonChipProps['size']>, number> = {
  sm: 14,
  md: 18,
  lg: V3FontSize.lg,
}

export default function RibbonChip({
  kicker,
  value,
  tone = 'ink',
  size = 'sm',
  className,
  style,
}: RibbonChipProps) {
  const bg = TONE_BG[tone]
  const fg = TONE_FG[tone]
  return (
    <span
      className={className}
      style={{
        background: bg,
        color: fg,
        padding: '4px 8px',
        borderRadius: 2,
        textAlign: 'center',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 50,
        ...style,
      }}
    >
      <Mono
        color={fg}
        size="xxs"
        weight={600}
        letterSpacing="0.18em"
        style={{ opacity: 0.92 }}
      >
        {kicker}
      </Mono>
      <span
        style={{
          marginTop: 2,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: VALUE_SIZE[size],
          lineHeight: 1,
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </span>
    </span>
  )
}
