'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Scale,
  Footprints,
  UtensilsCrossed,
  AlertCircle,
} from 'lucide-react'

/**
 * AccuracyBreakdown — 변수별 신뢰도 progress bar.
 *
 * AccuracyCard 가 종합 점수 1개만 표시한다면, 이 컴포넌트는 펼쳐서
 * 각 변수의 정밀도와 가장 약한 변수를 짚어준다.
 *
 * # voice-guidelines §1 / §4
 *  - "신뢰도" 단어 X — "정밀도" / "맞춤도"
 *  - 가장 약한 변수만 highlight (한 번에 부정 정보 한 가지)
 *  - "측정 도구 점검하면 + N% 올라요" 같은 긍정 톤
 *
 * # voice-guidelines §10
 * 접힘 상태 default — 사용자가 자발적으로 열어야 봐 진다. 압박 X.
 */

export type AccuracyVar = {
  key: 'weight' | 'activity' | 'feed'
  label: string
  score: number // 0~1
  /** 약한 변수일 때 사용자에게 보여줄 한 줄 개선 안내 */
  hint?: string
}

export default function AccuracyBreakdown({
  variables,
}: {
  variables: AccuracyVar[]
}) {
  const [open, setOpen] = useState(false)

  if (variables.length === 0) return null

  // 가장 약한 변수 1개 찾기 (점수 < 0.7 일 때만)
  const weakest = [...variables].sort((a, b) => a.score - b.score)[0]
  const showWeakHighlight = weakest.score < 0.7

  return (
    <section className="px-5 mt-3">
      <div
        className="rounded-2xl border bg-white"
        style={{ borderColor: 'var(--rule)' }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left"
          aria-expanded={open}
          aria-controls="accuracy-breakdown-panel"
        >
          <span className="text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
            변수별 맞춤도 자세히
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted" strokeWidth={2.2} />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" strokeWidth={2.2} />
          )}
        </button>

        {open && (
          <div
            id="accuracy-breakdown-panel"
            className="px-5 pb-4 space-y-3"
          >
            {variables.map((v) => (
              <Row key={v.key} variable={v} />
            ))}

            {showWeakHighlight && weakest.hint && (
              <div
                className="mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--gold) 10%, white)',
                  border:
                    '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
                }}
              >
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  strokeWidth={2}
                  style={{ color: 'var(--gold)' }}
                />
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: 'var(--ink)' }}
                >
                  <strong>{weakest.label}</strong>이 가장 약해요.{' '}
                  {weakest.hint}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Row({ variable }: { variable: AccuracyVar }) {
  const pct = Math.round(variable.score * 100)
  const accent =
    variable.score >= 0.85
      ? 'var(--moss)'
      : variable.score >= 0.7
        ? 'var(--terracotta)'
        : variable.score >= 0.5
          ? 'var(--gold)'
          : 'var(--sale)'
  const Icon =
    variable.key === 'weight'
      ? Scale
      : variable.key === 'activity'
        ? Footprints
        : UtensilsCrossed

  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, white)`,
          color: accent,
        }}
        aria-hidden
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11.5px] font-bold"
            style={{ color: 'var(--ink)' }}
          >
            {variable.label}
          </span>
          <span
            className="text-[10.5px] font-bold tabular-nums"
            style={{ color: 'var(--muted)' }}
          >
            {pct}%
          </span>
        </div>
        <div
          className="mt-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'color-mix(in srgb var(--rule) 60%, white)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${variable.label} 맞춤도 ${pct}%`}
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>
    </div>
  )
}
