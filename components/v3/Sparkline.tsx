/**
 * Sparkline — SVG 미니 라인 차트.
 *
 * 핸드오프 패턴: 체중/활동 추이 9~12 포인트 라인 + 마지막 dot 강조 + 옵션 fill.
 * 색상은 V3 token 사용. width/height 자유 설정.
 *
 * @example 9개월 체중 추이 ink hero 카드 안
 *   <Sparkline data={[3.7, 3.8, 3.9, 3.9, 4.0, 4.0, 4.1, 4.0, 4.0]}
 *              width={362} height={100} color={V3.yellow}
 *              fill="rgba(230,185,66,0.14)" />
 *
 * @example 14일 활동 strip
 *   <Sparkline data={steps} width={130} height={28} color={V3.yellow} />
 */

import { V3 } from '@/lib/design/tokens'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  /** 라인 색상. 기본 accent. */
  color?: string
  /** 영역 채우기 색. undefined 면 fill 없음. */
  fill?: string
  /** 라인 두께. 기본 2. */
  strokeWidth?: number
  /** 마지막 dot 강조. 기본 true. */
  lastDot?: boolean
  /** y 축 padding (값 범위 위/아래 여유). 기본 0.2. */
  yPadding?: number
  className?: string
  style?: React.CSSProperties
}

export default function Sparkline({
  data,
  width = 200,
  height = 60,
  color = V3.accent,
  fill,
  strokeWidth = 2,
  lastDot = true,
  yPadding = 0.2,
  className,
  style,
}: SparklineProps) {
  if (!data || data.length === 0) return null

  const min = Math.min(...data) - yPadding
  const max = Math.max(...data) + yPadding
  const range = Math.max(0.001, max - min) // div-by-zero 방지

  // x = data index 를 width 에 등간격 매핑
  const dx = data.length > 1 ? width / (data.length - 1) : width
  const yOf = (v: number) => height - ((v - min) / range) * height
  const pointsArr = data.map((v, i) => [i * dx, yOf(v)] as const)
  const pointsStr = pointsArr.map(([x, y]) => `${x},${y}`).join(' ')

  const lastPoint = pointsArr[pointsArr.length - 1]
  const lastX = lastPoint ? lastPoint[0] : 0
  const lastY = lastPoint ? lastPoint[1] : 0

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={style}
      role="img"
      aria-hidden
    >
      {fill && (
        <polygon
          points={`0,${height} ${pointsStr} ${width},${height}`}
          fill={fill}
        />
      )}
      <polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastDot && (
        <circle cx={lastX} cy={lastY} r={3} fill={color} />
      )}
    </svg>
  )
}
