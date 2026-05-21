/**
 * Mark — v3 의 노란 마커 하이라이트.
 *
 * 본문 키워드를 강조하는 인라인 element. `<mark>` semantic 사용.
 * 기본 yellow(#e6b942) 배경 + ink 텍스트 + 4px 양쪽 padding.
 * 색상은 yellow / sage / accent 3가지만.
 *
 * @example
 *   오늘도 한 끼를 <Mark>정성스럽게.</Mark>
 *   <Mark tone="sage">안정 구간</Mark>
 */

import { V3 } from '@/lib/design/tokens'

interface MarkProps {
  children: React.ReactNode
  /** tone — 마커 색. yellow(default) / sage / accent. */
  tone?: 'yellow' | 'sage' | 'accent'
  className?: string
  style?: React.CSSProperties
}

const TONE_BG: Record<NonNullable<MarkProps['tone']>, string> = {
  yellow: V3.yellow,
  sage: V3.sage,
  accent: V3.accent,
}

const TONE_FG: Record<NonNullable<MarkProps['tone']>, string> = {
  yellow: V3.ink,
  sage: V3.paperHi,
  accent: V3.paperHi,
}

export default function Mark({
  children,
  tone = 'yellow',
  className,
  style,
}: MarkProps) {
  return (
    <mark
      className={className}
      style={{
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        padding: '0 4px',
        fontWeight: 700,
        borderRadius: 0,
        ...style,
      }}
    >
      {children}
    </mark>
  )
}
