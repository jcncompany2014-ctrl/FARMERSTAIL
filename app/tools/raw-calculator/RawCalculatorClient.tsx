'use client'

/**
 * Round E1 (2026-05-20): /tools/raw-calculator 클라이언트 폼.
 *
 * 사용자가 식재료 + g 입력 → 실시간 Ca:P 계산 + NSH 가드 메시지.
 */

import { useState, useMemo } from 'react'
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  RAW_INGREDIENTS,
  calculateCaPRatio,
  type RawEntry,
  type CaPResult,
} from '@/lib/raw-ca-p-calculator'

export default function RawCalculatorClient() {
  const [entries, setEntries] = useState<RawEntry[]>([
    { ingredient: 'chicken_breast', grams_per_day: 200 },
  ])
  // Round E2 (2026-05-20): 자견 (< 12개월) 모드 토글 — Ca:P 안전범위 1.0~1.6.
  const [isPuppy, setIsPuppy] = useState(false)

  const result: CaPResult = useMemo(
    () => calculateCaPRatio(entries, { isPuppy }),
    [entries, isPuppy],
  )

  function addEntry() {
    setEntries((prev) => [
      ...prev,
      { ingredient: RAW_INGREDIENTS[0]!.id, grams_per_day: 100 },
    ])
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateEntry(idx: number, patch: Partial<RawEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    )
  }

  return (
    <>
      {/* 자견 모드 토글 */}
      <section className="mt-5 rounded-2xl border border-rule bg-white p-4 flex items-center justify-between">
        <div>
          <p className="text-[12.5px] font-bold text-ink">자견 (12개월 미만)</p>
          <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
            ON 시 Ca:P 안전 범위 1.0~1.6 으로 엄격 적용 (FEDIAF Growth).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPuppy}
          onClick={() => setIsPuppy((v) => !v)}
          className={`relative w-12 h-7 rounded-full transition ${
            isPuppy ? 'bg-terracotta' : 'bg-rule'
          }`}
        >
          <span
            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow"
            style={{ transform: isPuppy ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </section>

      {/* 식재료 입력 */}
      <section className="mt-3 rounded-2xl border border-rule bg-white p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          식재료 입력
        </h2>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <EntryRow
              key={i}
              entry={entry}
              onChange={(patch) => updateEntry(i, patch)}
              onRemove={() => removeEntry(i)}
              canRemove={entries.length > 1}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-rule text-[12px] font-bold text-muted hover:text-text hover:border-text transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          식재료 추가
        </button>
      </section>

      {/* 결과 */}
      <section
        className="mt-5 rounded-2xl border-2 p-5"
        style={{
          borderColor: levelColor(result.level),
          background:
            result.level === 'safe'
              ? 'rgba(139, 160, 90, 0.06)'
              : result.level === 'nsh_risk' || result.level === 'excess'
                ? 'rgba(199, 106, 78, 0.06)'
                : 'rgba(224, 179, 65, 0.06)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          {result.level === 'safe' ? (
            <CheckCircle2
              className="w-5 h-5"
              style={{ color: levelColor(result.level) }}
              strokeWidth={2}
            />
          ) : (
            <AlertTriangle
              className="w-5 h-5"
              style={{ color: levelColor(result.level) }}
              strokeWidth={2}
            />
          )}
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
            결과
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <KpiCell label="Ca (mg/일)" value={result.total_ca_mg} />
          <KpiCell label="P (mg/일)" value={result.total_p_mg} />
          <KpiCell
            label="Ca:P 비율"
            value={result.ratio.toFixed(2)}
            highlight={levelColor(result.level)}
          />
        </div>

        <p
          className="text-[12px] leading-relaxed"
          style={{ color: 'var(--ink)' }}
        >
          {result.message_ko}
        </p>
      </section>

      {/* 입력별 detail */}
      {result.per_ingredient.length > 0 && (
        <section className="mt-5 rounded-2xl border border-rule bg-white p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
            입력 명세
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-muted border-b border-rule">
                  <th className="py-2 pr-3 font-bold">식재료</th>
                  <th className="py-2 px-2 font-bold text-right">g/일</th>
                  <th className="py-2 px-2 font-bold text-right">Ca mg</th>
                  <th className="py-2 pl-2 font-bold text-right">P mg</th>
                </tr>
              </thead>
              <tbody>
                {result.per_ingredient.map((row, i) => (
                  <tr key={i} className="border-b border-rule/40">
                    <td className="py-2 pr-3 text-ink">
                      {row.ingredient.name_ko}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                      {row.grams}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                      {row.ca_mg}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono tabular-nums text-ink">
                      {row.p_mg}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function EntryRow({
  entry,
  onChange,
  onRemove,
  canRemove,
}: {
  entry: RawEntry
  onChange: (patch: Partial<RawEntry>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="flex gap-2 items-stretch">
      <select
        value={entry.ingredient}
        onChange={(e) => onChange({ ingredient: e.target.value })}
        className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-rule text-[12px] focus:outline-none focus:border-terracotta bg-white"
      >
        {RAW_INGREDIENTS.map((ing) => (
          <option key={ing.id} value={ing.id}>
            {ing.name_ko}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min={0}
          max={2000}
          value={entry.grams_per_day}
          onChange={(e) =>
            onChange({
              grams_per_day: Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
          className="w-20 px-2 py-2.5 rounded-lg border border-rule text-[12px] text-right focus:outline-none focus:border-terracotta"
        />
        <span className="text-[10.5px] font-bold text-muted px-1">g/일</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="px-2.5 rounded-lg border border-rule text-muted hover:text-sale hover:border-sale disabled:opacity-30 disabled:hover:text-muted disabled:hover:border-rule transition"
        aria-label="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

function KpiCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: string
}) {
  return (
    <div className="rounded-lg border border-rule/60 bg-white px-3 py-2.5">
      <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p
        className="text-[18px] font-['Archivo_Black'] tabular-nums mt-0.5"
        style={{ color: highlight ?? 'var(--ink)' }}
      >
        {value}
      </p>
    </div>
  )
}

function levelColor(level: CaPResult['level']): string {
  switch (level) {
    case 'safe':
      return '#8BA05A'
    case 'borderline_low':
    case 'borderline_high':
      return '#E0B341'
    case 'nsh_risk':
    case 'excess':
      return '#C76A4E'
  }
}
