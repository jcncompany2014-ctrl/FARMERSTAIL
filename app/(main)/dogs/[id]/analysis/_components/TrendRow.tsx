/**
 * TrendRow — 추이 카드 한 row (체형 BCS / 체중) 의 small-multiples sparkline.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * 현재 호출부는 모두 `style={{ display: 'none' }}` 또는 `{false && ...}` dead-block
 * 안에 있어 실제 렌더되진 않지만 코드 보존 차원으로 그대로 둠.
 */
'use client'

import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

type TrendRowProps = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  values: number[]
  labels: string[]
  format: (v: number) => string
  color: string
}

export default function TrendRow({
  Icon,
  label,
  values,
  labels,
  format,
  color,
}: TrendRowProps) {
  const first = values[0]!
  const last = values[values.length - 1]!
  const delta = last - first
  const deltaSign =
    delta === 0
      ? '변화 없음'
      : delta > 0
      ? `+${delta.toFixed(1)}`
      : delta.toFixed(1)
  const DirIcon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown
  const dirColor = 'text-muted'

  const W = 180
  const H = 36
  const PAD = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (W - PAD * 2) / Math.max(values.length - 1, 1)
  const pts = values.map((v, i) => {
    const x = PAD + i * step
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return { x, y }
  })
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${path} L ${pts[pts.length - 1]!.x.toFixed(1)} ${
    H - PAD
  } L ${pts[0]!.x.toFixed(1)} ${H - PAD} Z`

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text">
          <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
          {label}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${dirColor}`}
        >
          <DirIcon className="w-3 h-3" strokeWidth={2.5} />
          {deltaSign}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="flex-1 max-w-[180px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${label})`} />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 3 : 1.8}
              fill={i === pts.length - 1 ? color : 'white'}
              stroke={color}
              strokeWidth={i === pts.length - 1 ? 1.5 : 1.2}
            />
          ))}
        </svg>
        <div className="text-right leading-tight">
          <div className="text-[9px] text-muted font-semibold uppercase tracking-[0.15em]">
            {labels[0]}
          </div>
          <div className="text-[9px] text-muted">↓</div>
          <div className="text-[13px] font-black text-text">
            {format(last)}
          </div>
        </div>
      </div>
    </div>
  )
}
