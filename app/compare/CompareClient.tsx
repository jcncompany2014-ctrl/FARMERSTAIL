'use client'

/**
 * Round C1 (2026-05-20): /compare 페이지의 인터랙티브 client 부분.
 *
 *  - 5종 스파이더 (Recharts Radar)
 *  - 페르소나별 추천 selector
 *  - 5종 토글 (개별 on/off)
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  SKU_NUTRITION,
  normalizeForRadar,
  recommendByPersona,
  type SkuPersona,
} from '@/lib/sku-nutrition-matrix'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'

const PERSONA_LABEL: Record<SkuPersona, string> = {
  beginner: '입문',
  senior: '노령',
  allergy: '알레르기',
  active: '활동多',
  sensitive: '소화민감',
}

const PERSONA_HINT: Record<SkuPersona, string> = {
  beginner: '첫 화식. 안정 운영 기본형.',
  senior: '7세 ↑ (대형 5세 ↑). EPA/DHA 자연 보강.',
  allergy: 'IgE 진단·증상 의심. Novel protein 회피 매트릭스.',
  active: '산책 1h+ / 강아지 청년기 / 운동량 多.',
  sensitive: '연변·구토·식이 변화 적응 어려움.',
}

// 5종 색상 — Cohort 대시보드와 동일 톤
const SKU_COLORS: Record<SkuKey, string> = {
  C01: '#C76A4E', // terracotta
  D02: '#8BA05A', // moss
  S03: '#7A99B3', // dust blue
  P04: '#A87BA0', // mauve
  B05: '#E0B341', // mustard
}

// SKU → 제품 slug. 연어(S03)는 아직 미출시 → null (카드에 "출시 예정" 표기,
// 404 링크 방지). 나머지 4종은 실제 PDP 로 연결 (audit P0: 비교 페이지 데드엔드).
const SKU_SLUG: Record<SkuKey, string | null> = {
  C01: 'chicken-basic',
  D02: 'duck-weight',
  S03: null,
  P04: 'pork-joint',
  B05: 'beef-premium',
}

export default function CompareClient({ skus }: { skus: SkuKey[] }) {
  const [selected, setSelected] = useState<Record<SkuKey, boolean>>(() =>
    Object.fromEntries(skus.map((s) => [s, true])) as Record<SkuKey, boolean>,
  )
  const [persona, setPersona] = useState<SkuPersona | null>(null)

  // 페르소나 토글: 클릭 시 추천 SKU 만 켜기. 같은 페르소나 재클릭 시 전체 ON.
  function pickPersona(p: SkuPersona) {
    if (persona === p) {
      setSelected(
        Object.fromEntries(skus.map((s) => [s, true])) as Record<SkuKey, boolean>,
      )
      setPersona(null)
      return
    }
    const rec = recommendByPersona(p)
    setSelected(
      Object.fromEntries(skus.map((s) => [s, rec.includes(s)])) as Record<
        SkuKey,
        boolean
      >,
    )
    setPersona(p)
  }

  // Radar data — 각 axis 별로 5종 값을 하나의 row 에 모음.
  const radarData = useMemo(() => {
    const axes: Array<keyof ReturnType<typeof normalizeForRadar>> = [
      '단백',
      '지방',
      'Ca:P',
      'EPA+DHA',
      'Se',
    ]
    return axes.map((axis) => {
      const row: Record<string, string | number> = { axis }
      for (const sku of skus) {
        if (!selected[sku]) continue
        const normalized = normalizeForRadar(SKU_NUTRITION[sku])
        row[sku] = normalized[axis]
      }
      return row
    })
  }, [selected, skus])

  return (
    <>
      {/* 페르소나 selector */}
      <section className="mt-6 rounded-2xl border border-rule bg-white p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          페르소나로 좁히기
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERSONA_LABEL) as SkuPersona[]).map((p) => (
            <button
              key={p}
              onClick={() => pickPersona(p)}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.97] ${
                persona === p
                  ? 'bg-terracotta text-white'
                  : 'bg-bg text-text hover:bg-rule/40'
              }`}
            >
              {PERSONA_LABEL[p]}
            </button>
          ))}
        </div>
        {persona && (
          <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
            {PERSONA_HINT[persona]}
          </p>
        )}
      </section>

      {/* 5종 스파이더 차트 */}
      <section className="mt-5 rounded-2xl border border-rule bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">
            영양 5축 스파이더
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {skus.map((sku) => (
              <button
                key={sku}
                onClick={() =>
                  setSelected((prev) => ({ ...prev, [sku]: !prev[sku] }))
                }
                className={`px-2 py-1 rounded-full text-[10px] font-bold font-mono tracking-tight transition ${
                  selected[sku]
                    ? 'text-white'
                    : 'bg-bg text-muted hover:text-text'
                }`}
                style={
                  selected[sku] ? { background: SKU_COLORS[sku] } : undefined
                }
              >
                {SKU_META[sku].code}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="80%">
              <PolarGrid stroke="#E5DBC9" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fontSize: 11, fill: '#3D2F22' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#8E8779' }}
              />
              {skus
                .filter((sku) => selected[sku])
                .map((sku) => (
                  <Radar
                    key={sku}
                    name={`${SKU_META[sku].code} · ${SKU_META[sku].name_ko}`}
                    dataKey={sku}
                    stroke={SKU_COLORS[sku]}
                    fill={SKU_COLORS[sku]}
                    fillOpacity={0.18}
                  />
                ))}
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid #E5DBC9',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10.5, paddingTop: 8 }}
                iconType="circle"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
          ※ 0-100 으로 정규화한 값. 100 = FEDIAF 권장 상한.
        </p>
      </section>

      {/* SKU 카드 */}
      <section className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {skus
          .filter((sku) => selected[sku])
          .map((sku) => {
            const meta = SKU_META[sku]
            const nutrition = SKU_NUTRITION[sku]
            const slug = SKU_SLUG[sku]
            return (
              <article
                key={sku}
                className="rounded-2xl border border-rule bg-white p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-['Archivo_Black'] text-[14px] text-white"
                    style={{ background: SKU_COLORS[sku] }}
                  >
                    {meta.code.slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-bold text-ink">
                      {meta.code} · {meta.name_ko}
                      {meta.novel && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight text-moss bg-moss/10">
                          novel
                        </span>
                      )}
                    </h3>
                    <p className="text-[11.5px] text-muted mt-1 leading-relaxed">
                      {nutrition.highlight_ko}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {nutrition.persona.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-bg text-text"
                        >
                          {PERSONA_LABEL[p]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* PDP CTA — 비교 페이지 데드엔드 해소 (audit P0). 연어는 미출시 → 출시 예정. */}
                {slug ? (
                  <Link
                    href={`/products/${slug}`}
                    className="flex items-center justify-center gap-1 rounded-full bg-ink py-2.5 text-[12px] font-bold text-white transition active:scale-[0.98] hover:opacity-90"
                  >
                    {meta.name_ko} 화식 보러가기
                    <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-center rounded-full bg-bg py-2.5 text-[12px] font-bold text-muted">
                    출시 예정
                  </div>
                )}
              </article>
            )
          })}
      </section>
    </>
  )
}
