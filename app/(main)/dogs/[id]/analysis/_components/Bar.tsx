/**
 * Bar — 영양소 권장 범위 비교 막대 (legacy 폐기) row.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * 현재 호출부는 `style={{ display: 'none' }}` legacy block 안에만 있음 —
 * Magazine NutrientsCard 가 대체. 코드 보존 차원으로 남김.
 */
'use client'

import { Check, TrendingDown, TrendingUp } from 'lucide-react'
import type { MacroRange } from '@/lib/nutrition'

type BarProps = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  pct: number
  g: number
  color: string
  range: MacroRange
}

export default function Bar({ Icon, label, pct, g, color, range }: BarProps) {
  const { min, max, scale } = range
  const fillWidth = Math.min((pct / scale) * 100, 100)
  const bandLeft = (min / scale) * 100
  const bandWidth = Math.max(((max - min) / scale) * 100, 2)

  const status: 'under' | 'ok' | 'over' =
    pct < min ? 'under' : pct > max ? 'over' : 'ok'

  const StatusIcon =
    status === 'ok' ? Check : status === 'under' ? TrendingDown : TrendingUp
  const statusText =
    status === 'ok'
      ? '권장 범위 내'
      : status === 'under'
      ? '권장치 미달'
      : '권장치 상회'
  const statusColor =
    status === 'ok'
      ? 'text-moss'
      : status === 'under'
      ? 'text-muted'
      : 'text-terracotta'

  return (
    <div className="mb-4 last:mb-0">
      {/* UI audit: 영양소 4 row (단백질/지방/탄수/식이섬유) 퍼센트 자릿수 정렬. */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text">
          <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
          {label}
        </span>
        <span className="text-[12px] font-black text-terracotta tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-2.5 bg-rule rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 bg-text/15"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        <div
          className={`relative h-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[9px] text-muted font-semibold tabular-nums">
          {g}g/일 · 권장 {min}–{max}%
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${statusColor}`}
        >
          <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
          {statusText}
        </span>
      </div>
    </div>
  )
}
