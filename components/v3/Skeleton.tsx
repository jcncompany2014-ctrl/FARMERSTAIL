/**
 * Skeleton — v3 로딩 placeholder (item 94).
 *
 * 핸드오프 패턴:
 *   - paperHi bg + ruleSoft hue 의 1.5s opacity loop (shimmer 대신).
 *   - shape: line / circle / rect / hero / card 5종.
 *   - prefers-reduced-motion 가드 — animation 없이 정적 paperHi.
 *
 * 호출자는 layout 위치에 맞게 shape + width/height 명시.
 */

import { V3 } from '@/lib/design/tokens'

interface SkeletonProps {
  /** Shape preset. */
  shape?: 'line' | 'circle' | 'rect' | 'hero' | 'card'
  /** width — number(px) 또는 string. */
  width?: number | string
  /** height — number(px) 또는 string. */
  height?: number | string
  /** radius override. */
  radius?: number
  /** 추가 className. */
  className?: string
  /** 추가 style. */
  style?: React.CSSProperties
  /** "tone" — paper / paperDeep / ink (loading 위에 추가 layer). */
  tone?: 'paper' | 'paperDeep' | 'ink'
}

const SHAPE_DEFAULTS: Record<
  NonNullable<SkeletonProps['shape']>,
  {
    width: number | string
    height: number | string
    radius: number
  }
> = {
  line: { width: '100%', height: 14, radius: 2 },
  circle: { width: 48, height: 48, radius: 999 },
  rect: { width: '100%', height: 80, radius: 4 },
  hero: { width: '100%', height: 280, radius: 2 },
  card: { width: '100%', height: 120, radius: 4 },
}

const TONE_BG: Record<NonNullable<SkeletonProps['tone']>, string> = {
  paper: V3.paperHi,
  paperDeep: V3.paperDeep,
  ink: V3.ink,
}

export default function Skeleton({
  shape = 'line',
  width,
  height,
  radius,
  className,
  style,
  tone = 'paper',
}: SkeletonProps) {
  const d = SHAPE_DEFAULTS[shape]
  return (
    <div
      aria-hidden
      role="presentation"
      className={`ft-skeleton ${className ?? ''}`}
      style={{
        width: width ?? d.width,
        height: height ?? d.height,
        borderRadius: radius ?? d.radius,
        background: TONE_BG[tone],
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        className="ft-skeleton-pulse"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            tone === 'ink'
              ? 'linear-gradient(90deg, transparent, rgba(244,237,224,0.08), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(22,20,15,0.05), transparent)',
        }}
      />
    </div>
  )
}

/**
 * SkeletonStack — 한 번에 여러 line 을 stack 으로 그려야 할 때 (text 영역).
 *
 * @example
 *   <SkeletonStack lines={3} gap={8} />
 */
export function SkeletonStack({
  lines = 3,
  gap = 8,
  lastWidth = '70%',
}: {
  lines?: number
  gap?: number
  /** 마지막 line 의 폭 — paragraph 느낌. */
  lastWidth?: string
}) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          shape="line"
          width={i === lines - 1 ? lastWidth : '100%'}
        />
      ))}
    </div>
  )
}
