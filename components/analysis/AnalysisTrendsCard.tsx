'use client'

/**
 * AnalysisTrendsCard — 분석 페이지의 "최근 추이" 카드 (2026-05-21 추출).
 *
 * 기존 AnalysisView 안 inline 카드를 컴포넌트로 분리해서 Magazine 컨테이너
 * 안 + 옛 위치 둘 다 사용 가능하도록. 본문 narrative + TrendRow 차트는
 * 그대로. magazine 톤 (cream + corner mark) 적용.
 */

import Link from 'next/link'
import {
  LineChart,
  ArrowRight,
  Minus,
  TrendingUp,
  TrendingDown,
  Scale,
} from 'lucide-react'
import { WARM_CREAM } from '@/components/analysis/magazine/palette'
import { CornerMark as MagCornerMark } from '@/components/analysis/magazine/ReportCard'
import { summarizeHistory } from '@/lib/analysis/narrative'

export type HistoryPoint = {
  date: string
  bcs: number
  weight: number
}

interface Props {
  dogId: string
  dogName: string
  history: HistoryPoint[]
  totalCount: number
}

export default function AnalysisTrendsCard({
  dogId,
  dogName,
  history,
  totalCount,
}: Props) {
  return (
    <section className="px-5 mt-3">
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: WARM_CREAM.card,
          border: `1px solid ${WARM_CREAM.line}`,
          boxShadow: `0 1px 0 ${WARM_CREAM.line}55, 0 12px 28px ${WARM_CREAM.ink}10`,
        }}
      >
        <MagCornerMark p={WARM_CREAM} corner="tl" />
        <MagCornerMark p={WARM_CREAM} corner="bl" />
        <MagCornerMark p={WARM_CREAM} corner="br" />
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-moss" strokeWidth={1.8} />
            <div className="text-[13px] font-black text-text">최근 추이</div>
          </div>
          {totalCount > 1 && (
            <Link
              href={`/dogs/${dogId}/analyses`}
              className="text-[10px] font-bold text-terracotta hover:underline inline-flex items-center gap-0.5"
            >
              전체 기록 {totalCount}회
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          )}
        </div>
        <div className="text-[10px] text-muted font-semibold mb-4">
          설문 기록 {history.length}회 · 최신{' '}
          {formatDate(history[history.length - 1]?.date)}
        </div>
        {history.length < 2 ? (
          <div className="flex items-center gap-2 text-[11px] text-muted bg-bg rounded-xl px-4 py-3">
            <Minus className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            <span>
              설문을 2회 이상 완료하면 {dogName}의 체형·체중 변화가 여기 표시돼요.
            </span>
          </div>
        ) : (
          <div className="space-y-5">
            {(() => {
              const n = summarizeHistory(
                history.map((h) => ({ date: h.date, bcs: h.bcs, weight: h.weight })),
                dogName ?? null,
              )
              if (!n) return null
              const accent =
                n.tone === 'positive'
                  ? 'var(--moss)'
                  : n.tone === 'cautious'
                    ? 'var(--gold)'
                    : 'var(--muted)'
              return (
                <div
                  className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed font-bold"
                  style={{
                    background: `color-mix(in srgb, ${accent} 8%, white)`,
                    border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
                    color: 'var(--ink)',
                  }}
                >
                  {n.text}
                </div>
              )
            })()}
            <TrendRow
              Icon={Scale}
              label="체형 (BCS)"
              values={history.map((h) => h.bcs)}
              labels={history.map((h) => `BCS ${h.bcs}`)}
              format={(v) => `BCS ${v.toFixed(0)}`}
              color="var(--terracotta)"
            />
            <TrendRow
              Icon={TrendingUp}
              label="체중 (추정)"
              values={history.map((h) => h.weight)}
              labels={history.map((h) => `${h.weight}kg`)}
              format={(v) => `${v.toFixed(1)}kg`}
              color="var(--moss)"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}.${d.getDate()}`
}

function TrendRow({
  Icon,
  label,
  values,
  labels,
  format,
  color,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  values: number[]
  labels: string[]
  format: (v: number) => string
  color: string
}) {
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
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted">
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
          <div className="text-[13px] font-black text-text">{format(last)}</div>
        </div>
      </div>
    </div>
  )
}
