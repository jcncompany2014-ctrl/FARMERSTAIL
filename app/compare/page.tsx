import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import {
  SKU_NUTRITION,
  FEDIAF_REFERENCE,
  type SkuPersona,
} from '@/lib/sku-nutrition-matrix'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import CompareClient from './CompareClient'

export const metadata: Metadata = {
  title: '5종 비교 — 파머스테일',
  description:
    '닭·오리·연어·돼지·한우 5종 화식의 단백·지방·Ca:P·EPA/DHA·셀레늄 비교. 페르소나별 추천.',
}

/**
 * /compare — Round C1 (2026-05-20): 5종 SKU 영양 비교 페이지.
 *
 * # 카드
 *   1. 5종 SKU 영양 매트릭스 표 (단백·지방·Ca:P·EPA/DHA·Se)
 *   2. 5종 스파이더 차트 (Recharts Radar)
 *   3. 페르소나별 추천 — 입문·노령·알레르기·활동多·소화민감
 *
 * # 데이터
 *   lib/sku-nutrition-matrix.ts (자사 R&D 명세 + FEDIAF 교차검증).
 */
export default async function ComparePage() {
  const skus: SkuKey[] = ['C01', 'D02', 'S03', 'P04', 'B05']
  const matrixRows = skus.map((sku) => ({
    sku,
    meta: SKU_META[sku],
    nutrition: SKU_NUTRITION[sku],
  }))

  return (
    <main className="pb-20 max-w-5xl mx-auto px-5 pt-6">
      <Link
        href="/start"
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
      >
        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        맞춤 식단 시작하기
      </Link>

      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-moss" strokeWidth={2} />
        <h1 className="font-['Archivo_Black'] text-2xl md:text-3xl text-ink">
          5종 라인 비교
        </h1>
      </div>
      <p className="text-[12.5px] md:text-[13.5px] text-muted mt-1.5 leading-relaxed">
        닭·오리·연어·돼지·한우 5종 화식의 단백·지방·Ca:P·EPA/DHA·셀레늄을 한
        화면에. FEDIAF 권장 범위와 함께 비교해 보세요.
      </p>

      {/* 영양 매트릭스 표 */}
      <section className="mt-6 rounded-2xl border border-rule bg-white p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          영양 매트릭스 (DM 기준)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] md:text-[12.5px]">
            <thead>
              <tr className="text-left text-muted border-b border-rule">
                <th className="py-2 pr-3 font-bold">SKU</th>
                <th className="py-2 px-2 font-bold text-right">단백 %</th>
                <th className="py-2 px-2 font-bold text-right">지방 %</th>
                <th className="py-2 px-2 font-bold text-right">Ca:P</th>
                <th className="py-2 px-2 font-bold text-right">EPA+DHA %</th>
                <th className="py-2 px-2 font-bold text-right">Se mcg/kg</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map(({ sku, meta, nutrition }) => (
                <tr key={sku} className="border-b border-rule/40">
                  <td className="py-2 pr-3">
                    <div className="font-mono text-ink font-bold">
                      {meta.code}
                    </div>
                    <div className="text-[10.5px] text-muted">
                      {meta.name_ko}
                      {meta.novel && (
                        <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold tracking-tight text-moss bg-moss/10">
                          novel
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                    {nutrition.protein_pct.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                    {nutrition.fat_pct.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                    {nutrition.ca_p_ratio.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                    {nutrition.epa_dha_pct.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                    {nutrition.selenium_mcg_per_kg}
                  </td>
                </tr>
              ))}
              {/* FEDIAF 기준 행 */}
              <tr className="bg-bg/50">
                <td className="py-2 pr-3 text-[10.5px] font-bold uppercase tracking-wider text-muted">
                  FEDIAF 권장
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.protein_pct.min}-
                  {FEDIAF_REFERENCE.protein_pct.max}
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.fat_pct.min}-
                  {FEDIAF_REFERENCE.fat_pct.max}
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.ca_p_ratio.min}-
                  {FEDIAF_REFERENCE.ca_p_ratio.max}
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  ≥ {FEDIAF_REFERENCE.epa_dha_pct.min}
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.selenium_mcg_per_kg.min}-
                  {FEDIAF_REFERENCE.selenium_mcg_per_kg.max}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10.5px] text-muted mt-3 leading-relaxed">
          ※ DM = Dry Matter (수분 제외 건조 중량). 자사 R&D 시제품 분석 결과 +
          FEDIAF 2024 권장 범위 교차검증.
        </p>
      </section>

      {/* 5종 스파이더 + 페르소나 인터랙션 */}
      <CompareClient skus={skus} />

      <p className="text-[10.5px] text-muted mt-8 text-center leading-relaxed">
        설문 결과에 맞춰 자동 추천된 SKU 가 결제 단계에서 적용돼요.
        직접 비교해 보고 싶다면 위 차트를 참고하세요.
      </p>
    </main>
  )
}

// re-export for type-safe persona usage in client
export type { SkuPersona }
