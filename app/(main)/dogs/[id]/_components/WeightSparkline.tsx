import type { WeightLog } from './types'

/**
 * Tiny SVG sparkline of recent weight readings.
 * Receives logs in newest-first order; we reverse for left-to-right time axis.
 */
export default function WeightSparkline({ logs }: { logs: WeightLog[] }) {
  const series = [...logs].reverse()
  if (series.length < 2) {
    return (
      <div className="h-16 flex items-center justify-center bg-bg rounded-lg">
        <span className="text-[10.5px] text-muted">
          기록이 2개 이상 쌓이면 추이가 보여요
        </span>
      </div>
    )
  }

  const W = 280
  const H = 64
  const PAD = 6
  const weights = series.map((s) => s.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const points = series.map((s, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (series.length - 1)
    const y = H - PAD - ((s.weight - min) / range) * (H - PAD * 2)
    return { x, y, v: s.weight }
  })
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${points[0]!.x},${H} ${polyline} ${points[points.length - 1]!.x},${H}`
  const last = points[points.length - 1]!

  // SVG 는 시각 전용 — 스크린리더용으로 추세를 한 줄 요약(role=img + aria-label).
  const first = series[0]!.weight
  const trend = last.v > first ? '증가' : last.v < first ? '감소' : '유지'
  const ariaLabel = `체중 추이 그래프: 최근 ${series.length}개 기록, ${first}kg에서 ${last.v}kg으로 ${trend} (최저 ${min}kg · 최고 ${max}kg)`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="wlog-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--moss)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--moss)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#wlog-grad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--moss)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--terracotta)" />
        <circle cx={last.x} cy={last.y} r="1.5" fill="white" />
      </svg>
      <div className="flex justify-between text-[9px] text-muted mt-1 px-0.5">
        <span>{min}kg</span>
        <span className="font-bold text-text">{last.v}kg</span>
        <span>{max}kg</span>
      </div>
    </div>
  )
}
