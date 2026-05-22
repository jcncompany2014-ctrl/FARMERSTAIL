/**
 * Badge — v3 status chip / pill / count badge (2026-05-22 R10-5).
 *
 * **앱 컨텍스트 전용.** mypage / orders / subscriptions / wishlist 등에서
 * 인라인 재구현되던 패턴 (status chip, count pill, discount % 등) 추출.
 *
 * # API
 *
 *   // 기본 — 1px ink rule + paperHi bg + ink text
 *   <Badge>SAVED</Badge>
 *
 *   // 컬러 tone — solid bg (sage / accent / sale / yellow / ink)
 *   <Badge tone="sage" filled>구독 중</Badge>
 *   <Badge tone="accent" filled>NEW</Badge>
 *
 *   // count badge — small + pill
 *   <Badge tone="accent" filled size="sm" shape="pill">3</Badge>
 *
 *   // outlined accent — 토큰 색 + paperHi 채우기
 *   <Badge tone="accent">FIRST BOX</Badge>
 *
 * # Tone vs Filled
 *
 *   tone=default + filled=false → 1px rule + paperHi (가장 차분)
 *   tone=sage + filled=false → 1px sage 30% + paperHi + sage text
 *   tone=sage + filled=true → solid sage bg + paperHi text
 *   tone=ink + filled=true → solid ink bg + paperHi text (Default 같은 강조)
 *
 * # 디자인 핸드오프
 *
 *   - 폰트: Mono (kicker 톤) + uppercase + letter-spacing 0.08em
 *   - radius: shape='square' → 2px (V3.xs), 'pill' → 999
 *   - padding: sm → 2/6, md → 3/8
 *   - 작은 글자 (9.5~11px) 라 weight 700 권장
 */

import type { ReactNode } from 'react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export type BadgeTone =
  | 'default' // inkMute on paperHi — neutral
  | 'ink' // ink solid (filled) — "Default" 강조
  | 'sage' // 구독 중 / 완료 / 안전
  | 'accent' // 시그니처 / 가격 / 첫박스
  | 'sale' // 할인 / 오류 / 삭제
  | 'yellow' // 일시정지 / 주의

export type BadgeSize = 'sm' | 'md'
export type BadgeShape = 'square' | 'pill'

interface BadgeProps {
  children: ReactNode
  /** 색상 톤. 기본 'default' (inkMute). */
  tone?: BadgeTone
  /** true → solid bg + paperHi text. false (기본) → 1px border + paperHi bg + tone text. */
  filled?: boolean
  /** size — sm (9.5px) / md (11px). 기본 sm. */
  size?: BadgeSize
  /** shape — 'square' (radius 2px) / 'pill' (radius 999). 기본 'square'. */
  shape?: BadgeShape
  /** uppercase 끄기. 기본 true (Mono kicker 톤). */
  upper?: boolean
  /** 인라인 추가 style. */
  style?: React.CSSProperties
  className?: string
  /** aria-label — 시각 라벨이 짧으면 풀 설명 제공. */
  'aria-label'?: string
}

// ──────────────────────────────────────────────────────────────────
// Tone → 색 매핑
// ──────────────────────────────────────────────────────────────────

interface ToneColors {
  text: string
  bg: string
  border: string
  /** filled 시 text 컬러 (대비 보장). yellow 만 ink 사용. */
  filledText: string
}

const TONE: Record<BadgeTone, ToneColors> = {
  default: {
    text: V3.inkMute,
    bg: V3.paperHi,
    border: V3.rule,
    filledText: V3.paperHi,
  },
  ink: {
    text: V3.ink,
    bg: V3.paperHi,
    border: V3.rule,
    filledText: V3.paperHi,
  },
  sage: {
    text: V3.sage,
    bg: V3.paperHi,
    border: 'color-mix(in srgb, ' + V3.sage + ' 30%, transparent)',
    filledText: V3.paperHi,
  },
  accent: {
    text: V3.accent,
    bg: V3.paperHi,
    border: 'color-mix(in srgb, ' + V3.accent + ' 30%, transparent)',
    filledText: V3.paperHi,
  },
  sale: {
    text: V3.sale,
    bg: V3.paperHi,
    border: 'color-mix(in srgb, ' + V3.sale + ' 30%, transparent)',
    filledText: V3.paperHi,
  },
  yellow: {
    text: V3.ink, // yellow text on light bg invisible — use ink.
    bg: V3.paperHi,
    border: 'color-mix(in srgb, ' + V3.yellow + ' 50%, transparent)',
    filledText: V3.ink, // yellow bg + ink text — high contrast.
  },
}

const TONE_FILL: Record<BadgeTone, string> = {
  default: V3.inkMute,
  ink: V3.ink,
  sage: V3.sage,
  accent: V3.accent,
  sale: V3.sale,
  yellow: V3.yellow,
}

export default function Badge({
  children,
  tone = 'default',
  filled = false,
  size = 'sm',
  shape = 'square',
  upper = true,
  style,
  className,
  'aria-label': ariaLabel,
}: BadgeProps) {
  const colors = TONE[tone]
  const padding = size === 'sm' ? '2px 7px' : '3px 9px'
  const fontSize = size === 'sm' ? 9.5 : 11
  const borderRadius = shape === 'pill' ? V3Radius.pill : V3Radius.xs

  const background = filled ? TONE_FILL[tone] : colors.bg
  const color = filled ? colors.filledText : colors.text
  const border = filled ? 'none' : `1px solid ${colors.border}`

  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center ${className ?? ''}`}
      style={{
        gap: 3,
        padding,
        fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
        fontSize,
        fontWeight: V3FontWeight.bold,
        letterSpacing: '0.08em',
        textTransform: upper ? 'uppercase' : 'none',
        background,
        color,
        border,
        borderRadius,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
