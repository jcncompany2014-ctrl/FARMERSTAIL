import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import {
  SKU_NUTRITION,
  FEDIAF_REFERENCE,
  type SkuPersona,
} from '@/lib/sku-nutrition-matrix'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import { isAppContextServer } from '@/lib/app-context'
import CompareClient from './CompareClient'

/** 앱에서 웹 상세페이지를 외부 브라우저로 열 때 쓸 절대 URL 베이스. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export const metadata: Metadata = {
  title: '4종 비교 — 파머스테일',
  description:
    '치킨·오리·흑돼지·한우 4종 화식의 영양을 한 화면에서 비교해 보세요.',
  // 앱 전용 화면 — 검색에 노출되면 웹 방문자가 들어왔다가 튕긴다.
  robots: { index: false, follow: false },
}

/**
 * /compare — 레시피 4종 영양 비교 (앱 분석 페이지 전용 — 2026-07-15).
 *
 * # 카드
 *   1. 4종 영양 매트릭스 표 (단백·지방·Ca:P·EPA/DHA·Se)
 *   2. 4종 스파이더 차트 (Recharts Radar)
 *   3. 페르소나별 추천 — 입문·노령·알레르기·활동多·소화민감
 *
 * # 데이터
 *   lib/sku-nutrition-matrix.ts (자사 R&D 명세 + FEDIAF 교차검증).
 *
 * # ⛔ 앱 전용 (사장님 2026-07-15 "compare 페이지는 다른 어느 곳에서도 안 뜨고
 *   무조건 앱 내 분석 페이지에서만 뜬다")
 *   유일한 입구 = 앱 분석 페이지의 '4종 라인 비교' 카드. 웹 컨텍스트로 들어오면
 *   홈으로 돌려보낸다(직접 URL·옛 링크·검색 유입 방어). sitemap 미포함 +
 *   robots noindex 도 같은 이유. 새 진입점을 만들 땐 이 규칙부터 확인할 것.
 */
export default async function ComparePage() {
  const isApp = await isAppContextServer()
  if (!isApp) redirect('/')

  const skus: SkuKey[] = ['C01', 'D02', 'P04', 'B05']
  const matrixRows = skus.map((sku) => ({
    sku,
    meta: SKU_META[sku],
    nutrition: SKU_NUTRITION[sku],
  }))

  return (
    // w-full + min-w-0 — body 가 flex(column) 컨테이너라 main 은 flex item 이다.
    //  · min-w-0: flex item 의 기본 min-width:auto 는 내용의 min-content 아래로
    //    줄어들지 않아, 아래 표의 min-w-[460px] 가 위로 전파된다.
    //  · w-full: mx-auto(auto 마진)가 교차축 stretch 를 꺼버려서 main 이 내용
    //    크기(max-content)로 부푼다. 가로를 명시해야 375px 에 묶인다.
    // 둘 중 하나만 빠져도 모바일에서 페이지 본문이 통째로 가로 스크롤된다.
    <main className="pb-20 w-full max-w-5xl mx-auto px-5 pt-6 min-w-0">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-moss" strokeWidth={2} />
        <h1 className="font-['Archivo_Black'] text-2xl md:text-3xl text-ink">
          4종 라인 비교
        </h1>
      </div>
      <p className="text-[12.5px] md:text-[13.5px] text-muted mt-1.5 leading-relaxed">
        치킨·오리·흑돼지·한우 4종 화식의 단백질·지방·칼슘/인·오메가3·셀레늄을 한
        화면에. 4종 모두 AAFCO 2024 · FEDIAF 국제 기준을 충족해요.
      </p>

      {/* 영양 매트릭스 표 */}
      <section className="mt-6 rounded-2xl border border-rule bg-white p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          영양 매트릭스 (DM 기준)
        </h2>
        {/* 모바일에서 6열이 안 들어간다 — w-full 로 욱여넣으면 '49.5' 가 두 줄로
            쪼개져 숫자가 뭉갠다. min-w 를 줘서 뭉개는 대신 옆으로 스크롤시킨다. */}
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[460px] text-[11.5px] md:text-[12.5px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-muted border-b border-rule">
                <th className="py-2 pr-3 font-bold">레시피</th>
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
                  {/* 내부 코드(FT-C01)·'novel' 배지 제거 — 고객이 못 알아듣는
                      말은 쓰지 않는다(사장님 2026-07-14). 표시명만 남긴다. */}
                  <td className="py-2 pr-3">
                    <div className="text-[12px] font-bold text-ink">
                      {meta.name_ko}
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
              {/* 국제 기준 행 — 단백·지방은 '최소'다. 예전엔 '18-35' 처럼 범위로
                  적어서, 우리 수치(49.5)가 상한을 넘긴 것처럼 읽혔다. 실제로는
                  AAFCO/FEDIAF 가 단백·지방에 상한을 두지 않는다(사장님 2026-07-15
                  "오히려 우리가 충족을 안 해 다 오바하지?" → 아니고, 최소치를
                  넉넉히 넘긴 것). 진짜 범위가 있는 Ca:P·셀레늄만 범위로 적는다. */}
              <tr className="bg-bg/50">
                <td className="py-2 pr-3 text-[10.5px] font-bold uppercase tracking-wider text-muted">
                  국제 기준
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.protein_pct.min} 이상
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.fat_pct.min} 이상
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.ca_p_ratio.min}-
                  {FEDIAF_REFERENCE.ca_p_ratio.max}
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.epa_dha_pct.min} 이상
                </td>
                <td className="py-2 px-2 text-right text-[10.5px] text-muted tabular-nums">
                  {FEDIAF_REFERENCE.selenium_mcg_per_kg.min}-
                  {FEDIAF_REFERENCE.selenium_mcg_per_kg.max}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-xl bg-moss/[0.07] border border-moss/25 px-3.5 py-3">
          <p className="text-[11.5px] font-bold text-ink leading-relaxed">
            4종 모두 AAFCO 2024 · FEDIAF 기준을 충족해요.
          </p>
          <p className="text-[10.5px] text-muted mt-1.5 leading-relaxed">
            단백질과 지방은 <strong>최소 기준</strong>만 정해져 있어요(상한 없음).
            파머스테일 화식이 기준보다 높은 건 고기가 그만큼 많이 들어가서예요.
            과하면 해로운 영양소(비타민 D·셀레늄·칼슘:인)는 정해진 범위 안에서
            관리하고 있어요.
          </p>
        </div>
        <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
          ※ DM = Dry Matter (수분 제외 건조 중량). 자사 R&D 시제품 분석 결과 +
          AAFCO 2024 · FEDIAF 기준 교차검증.
        </p>
      </section>

      {/* 5종 스파이더 + 페르소나 인터랙션 */}
      <CompareClient skus={skus} isApp siteUrl={SITE_URL} />

      <p className="text-[10.5px] text-muted mt-8 text-center leading-relaxed">
        설문 결과에 맞춰 자동으로 추천된 레시피가 주문 단계에 그대로 담겨요.
        직접 비교해 보고 싶다면 위 차트를 참고하세요.
      </p>
    </main>
  )
}

// re-export for type-safe persona usage in client
export type { SkuPersona }
