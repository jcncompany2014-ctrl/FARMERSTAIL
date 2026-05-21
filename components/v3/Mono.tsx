/**
 * Mono — v3 의 모든 ALL CAPS 메타데이터 / kicker / ticker / 카운터.
 *
 * IBM Plex Mono (fallback JetBrains Mono) + uppercase + letter-spacing 0.16em.
 * 색상은 기본 inkMute, 필요 시 prop 으로 override.
 *
 * @example
 *   <Mono>Hello, Seongmin · evening</Mono>
 *   <Mono color="accent" weight={700}>D-1</Mono>
 *   <Mono size="xxs">FAMILY · 3</Mono>
 */

import { V3, V3FontSize, type V3FontSizeKey } from '@/lib/design/tokens'

interface MonoProps {
  children: React.ReactNode
  /** size 별칭 — xxs(9) / xs(10.5) / sm(12). 그 외 size 는 디자인 합의 필요. */
  size?: Extract<V3FontSizeKey, 'xxs' | 'xs' | 'sm'>
  /** color — token name 또는 css 값 직접. 기본 inkMute. */
  color?: keyof typeof V3 | (string & {})
  /** font-weight — 400(default) / 500(medium) / 600(semibold) / 700(bold). */
  weight?: 400 | 500 | 600 | 700
  /** letter-spacing override. 기본 0.16em. */
  letterSpacing?: string | number
  /** uppercase 끄기. 기본 true. */
  upper?: boolean
  /** 인라인 / 블록. 기본 inline (span). */
  as?: 'span' | 'div'
  className?: string
  style?: React.CSSProperties
}

export default function Mono({
  children,
  size = 'xs',
  color = 'inkMute',
  weight = 500,
  letterSpacing = '0.16em',
  upper = true,
  as: Tag = 'span',
  className,
  style,
}: MonoProps) {
  const resolvedColor =
    color in V3 ? V3[color as keyof typeof V3] : (color as string)

  return (
    <Tag
      className={className}
      style={{
        fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
        fontSize: V3FontSize[size],
        fontWeight: weight,
        letterSpacing,
        textTransform: upper ? 'uppercase' : 'none',
        color: resolvedColor,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
