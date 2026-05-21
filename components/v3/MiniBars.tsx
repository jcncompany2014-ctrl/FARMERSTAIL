/**
 * MiniBars — 7일/12개 막대 mini chart.
 *
 * 핸드오프 패턴: 식사/산책/체중 sparkline 류 짧은 막대 시각화.
 * data 의 max 또는 명시 max 로 정규화 + 최소 높이 2px (값 0 도 표시).
 *
 * @example
 *   <MiniBars data={[2, 3, 2.4, 3.2, 2.8, 3.5, 3.2]} height={32} />
 */

import { V3 } from '@/lib/design/tokens'

interface MiniBarsProps {
  data: number[]
  /** y-axis max. 명시 안 하면 data 의 max 사용. */
  max?: number
  /** 막대 색. 기본 ink. */
  color?: string
  height?: number
  /** 막대 사이 gap (px). 기본 3. */
  gap?: number
  /** 명시 width. 기본 100% (부모 폭 채움). */
  width?: number | string
  className?: string
  style?: React.CSSProperties
}

export default function MiniBars({
  data,
  max,
  color = V3.ink,
  height = 32,
  gap = 3,
  width,
  className,
  style,
}: MiniBarsProps) {
  if (!data || data.length === 0) return null
  const m = max || Math.max(...data, 1)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap,
        height,
        width,
        ...style,
      }}
      aria-hidden
    >
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / m) * 100}%`,
            minHeight: 2,
            background: color,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  )
}
