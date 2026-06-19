'use client'

/**
 * Round C2 (2026-05-20): 38영양소 게이지 그리드.
 *
 * 분석 페이지(AnalysisView)에 삽입. 자사 평균 화식 (ft_typical) 기준
 * NIAS 색상 (🟢 권장 / 🟡 경계 / 🔴 범위 밖) 으로 시각화.
 *
 * # Props
 *   dogName  — 카피용
 *   skuCode? — 특정 SKU 데이터 매핑 (미래 — 현재는 ft_typical 만 사용)
 *
 * # 컬랩스
 *   카테고리별 5 그룹 (macro / amino / fatty / mineral / vitamin) 으로 묶어
 *   페이지 길이 부담 ↓. 카테고리 헤더 클릭 시 펼치기/접기.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { petName } from '@/lib/korean'
import {
  NUTRIENT_SPECS,
  CATEGORY_LABEL,
  statusFor,
  type NutrientCategory,
  type NutrientSpec,
} from '@/lib/nrc-38-nutrients'

const STATUS_COLOR: Record<
  ReturnType<typeof statusFor>,
  { bg: string; fg: string; emoji: string; label: string }
> = {
  good: { bg: '#8BA05A', fg: '#FFFFFF', emoji: '🟢', label: '권장 범위' },
  borderline: { bg: '#E0B341', fg: '#3D2F22', emoji: '🟡', label: '경계' },
  out_of_range: { bg: '#C76A4E', fg: '#FFFFFF', emoji: '🔴', label: '범위 밖' },
}

export default function NutrientGauges38({ dogName }: { dogName: string }) {
  const grouped = groupByCategory(NUTRIENT_SPECS)

  return (
    <section className="px-5 mt-5">
      <div className="rounded-2xl border border-rule bg-white p-5">
        <div className="mb-4">
          <span className="kicker">Nutrient/38</span>
          <h2
            className="font-serif mt-1.5"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {petName(dogName)}의 하루 영양 38가지 한눈에 보기 🐾
          </h2>
          <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
            FEDIAF 2024 / NRC 2006 권장 범위와 자사 평균 화식 영양 매트릭스를
            비교했어요. 🟢 권장 안 · 🟡 경계 · 🔴 범위 밖.
          </p>
        </div>

        <div className="space-y-3">
          {(Object.keys(grouped) as NutrientCategory[]).map((cat) => (
            <CategoryGroup key={cat} category={cat} specs={grouped[cat]} />
          ))}
        </div>

        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-rule/40">
          {(Object.entries(STATUS_COLOR) as Array<
            [keyof typeof STATUS_COLOR, (typeof STATUS_COLOR)[keyof typeof STATUS_COLOR]]
          >).map(([status, c]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: c.bg }}
              />
              <span className="text-[10.5px] font-bold text-muted">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CategoryGroup({
  category,
  specs,
}: {
  category: NutrientCategory
  specs: NutrientSpec[]
}) {
  const [open, setOpen] = useState(category === 'macro') // macro 만 default 열림
  return (
    <div className="rounded-xl border border-rule/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="text-[11.5px] font-bold uppercase tracking-widest text-muted">
          {CATEGORY_LABEL[category]} ({specs.length})
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {specs.map((spec) => (
            <NutrientRow key={spec.id} spec={spec} />
          ))}
        </div>
      )}
    </div>
  )
}

function NutrientRow({ spec }: { spec: NutrientSpec }) {
  const value = spec.ft_typical
  const status = statusFor(spec, value)
  const color = STATUS_COLOR[status]

  // 게이지 위치: fediaf_max 있으면 그 비율, 없으면 fediaf_min × 3 가정.
  const scaleMax = spec.fediaf_max ?? spec.fediaf_min * 3
  const valuePct = Math.min(100, (value / scaleMax) * 100)
  const minPct = Math.min(100, (spec.fediaf_min / scaleMax) * 100)
  const maxPct =
    spec.fediaf_max != null ? Math.min(100, (spec.fediaf_max / scaleMax) * 100) : 100

  return (
    <div className="rounded-lg border border-rule/40 px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-ink">{spec.name_ko}</span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: color.bg, color: color.fg }}
        >
          {color.emoji} {value}
          <span className="ml-0.5 font-mono text-[9.5px] opacity-80">
            {spec.unit}
          </span>
        </span>
      </div>
      {/* 게이지 트랙 */}
      <div className="relative h-1.5 rounded-full bg-bg overflow-hidden">
        {/* 권장 범위 표시 */}
        <div
          className="absolute h-full bg-moss/30"
          style={{
            left: `${minPct}%`,
            width: `${maxPct - minPct}%`,
          }}
        />
        {/* 실측값 dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{
            left: `calc(${valuePct}% - 5px)`,
            background: color.bg,
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9.5px] font-mono text-muted tabular-nums">
        <span>{spec.fediaf_min}</span>
        <span>{spec.fediaf_max ?? '∞'}</span>
      </div>
    </div>
  )
}

function groupByCategory(specs: NutrientSpec[]): Record<NutrientCategory, NutrientSpec[]> {
  const out: Record<NutrientCategory, NutrientSpec[]> = {
    macro: [],
    amino_acid: [],
    fatty_acid: [],
    mineral: [],
    vitamin: [],
  }
  for (const s of specs) {
    out[s.category].push(s)
  }
  return out
}
