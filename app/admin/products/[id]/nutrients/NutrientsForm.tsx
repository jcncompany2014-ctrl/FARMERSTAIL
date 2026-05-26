'use client'

/**
 * XL-1 (#19) — 38 영양소 input form (client).
 *
 * 카테고리별 6 섹션 (crude/energy/amino/fatty/minerals/vitamins).
 * AAFCO 기준값 옆 표기. 입력 후 즉시 평가 (below/above/missing).
 */

import { useMemo, useState, useTransition } from 'react'
import {
  CATEGORY_LABELS,
  NUTRIENTS,
  evaluateAafcoCompliance,
  nutrientsByCategory,
  type NutrientCategory,
  type NutrientSpec,
} from '@/lib/nutrients-spec'
import { saveNutrients } from './actions'

type InitialMap = Record<string, number | string | null | undefined>

export default function NutrientsForm({
  productId,
  initial,
}: {
  productId: string
  initial: InitialMap
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const n of NUTRIENTS) {
      const raw = initial[n.key]
      v[n.key] = raw == null ? '' : String(raw)
    }
    return v
  })
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  const grouped = useMemo(() => nutrientsByCategory(), [])

  const evalResult = useMemo(() => {
    const numeric: Record<string, number | null> = {}
    for (const n of NUTRIENTS) {
      const r = values[n.key]
      numeric[n.key] = r === '' ? null : Number(r)
    }
    return evaluateAafcoCompliance(numeric)
  }, [values])

  function onChange(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    start(async () => {
      const result = await saveNutrients(productId, values)
      if (result.ok) {
        setStatus('저장됨')
      } else {
        setStatus(`오류: ${result.reason}`)
      }
    })
  }

  const orderedCategories: NutrientCategory[] = [
    'crude',
    'energy',
    'amino',
    'fatty',
    'minerals',
    'vitamins',
  ]

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      {/* AAFCO 평가 카드 */}
      <div className="rounded border border-line bg-paperHi p-4 text-sm">
        <div className="font-semibold text-ink mb-2">AAFCO Adult Maintenance 평가</div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="미달" value={evalResult.below.length} color="sale" />
          <Stat label="초과" value={evalResult.above.length} color="sale" />
          <Stat label="미입력 (min 항목)" value={evalResult.missing.length} color="mute" />
        </div>
        {evalResult.below.length > 0 && (
          <div className="mt-3 text-xs text-sale">
            미달: {evalResult.below.map((n) => n.label).join(', ')}
          </div>
        )}
        {evalResult.above.length > 0 && (
          <div className="mt-1 text-xs text-sale">
            초과: {evalResult.above.map((n) => n.label).join(', ')}
          </div>
        )}
      </div>

      {orderedCategories.map((cat) => (
        <section key={cat}>
          <h2 className="text-base font-semibold text-ink mb-3">
            {CATEGORY_LABELS[cat]}
            <span className="ml-2 text-xs text-mute font-normal">
              ({grouped[cat].length}개)
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped[cat].map((n) => (
              <NutrientField
                key={n.key}
                spec={n}
                value={values[n.key] ?? ''}
                onChange={(v) => onChange(n.key, v)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 bg-paper py-4 border-t border-line flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-terracotta px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        {status && (
          <span
            className={`text-xs ${status.startsWith('오류') ? 'text-sale' : 'text-moss'}`}
          >
            {status}
          </span>
        )}
      </div>
    </form>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'sale' | 'mute'
}) {
  return (
    <div>
      <div className="text-xs text-mute">{label}</div>
      <div
        className={`text-lg font-semibold ${
          value === 0 ? 'text-moss' : color === 'sale' ? 'text-sale' : 'text-mute'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function NutrientField({
  spec,
  value,
  onChange,
}: {
  spec: NutrientSpec
  value: string
  onChange: (v: string) => void
}) {
  const numeric = value === '' ? null : Number(value)
  const below =
    spec.aafcoMin != null && numeric != null && numeric < spec.aafcoMin
  const above =
    spec.aafcoMax != null && numeric != null && numeric > spec.aafcoMax
  const flag = below || above

  // R57 — label↔input 사이 mb-1 (4px) → mb-1.5 (6px). 38개 입력 필드라
  // 누적되면 빽빽해 보이던 문제 완화. hint mt-1 (4px) → mt-1.5 (6px).
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-ink">{spec.label}</span>
        <span className="text-xs text-mute">
          {spec.aafcoMin != null && `min ${spec.aafcoMin}`}
          {spec.aafcoMin != null && spec.aafcoMax != null && ' / '}
          {spec.aafcoMax != null && `max ${spec.aafcoMax}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 rounded border px-3 py-2 text-sm bg-paper ${
            flag ? 'border-sale' : 'border-line'
          }`}
          placeholder="—"
        />
        <span className="text-xs text-mute w-14 text-right">{spec.unit}</span>
      </div>
      {spec.hint && (
        <div className="mt-1.5 text-xs text-mute leading-snug">{spec.hint}</div>
      )}
    </label>
  )
}
