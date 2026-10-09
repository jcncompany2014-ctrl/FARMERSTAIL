/**
 * 4종 비교 그리기 — page.tsx(앱 판정·redirect·AuthAwareShell)와 점검 화면(/design-check/analysis)이 같이 쓴다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A10):
 *   · 6칸 숫자 표(단백질 49% 이상 · Ca:P · EPA+DHA …) → 레시피마다 단백질·지방 **막대** + 국제 최소 기준 **눈금**,
 *     그리고 "✓ 칼슘·인 안전 범위 · 오메가3 충족 · 셀레늄 충족" 칩(정확한 영양소 % 를 글자로 쓰지 않는다).
 *   · 기준 약어(AAFCO 2024 · FEDIAF · DM)·영문 머리말(uppercase) → "국제 영양 기준" · "수분을 뺀 무게 기준".
 *   · 막대 길이 = 레이더와 같은 정본 정규화(normalizeForRadar) — 화면에서 새로 계산 기준을 만들지 않는다.
 *   이 화면은 앱 전용이다(page.tsx 가 웹 진입을 홈으로 돌려보낸다) — 웹 화면은 원래 없다.
 */

import {
  SKU_NUTRITION,
  FEDIAF_REFERENCE,
  normalizeForRadar,
} from '@/lib/sku-nutrition-matrix'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import { V3 } from '@/lib/design/tokens'
import { RECIPE_CHIP, RECIPE_COLOR } from '@/components/analysis/display'
import CompareClient from './CompareClient'
import type { ProteinKey } from '@/lib/personalization/skuModel'

function proteinOf(sku: SkuKey): ProteinKey {
  return SKU_META[sku].protein_en as ProteinKey
}

/** 국제 최소 기준 눈금 위치 — 같은 정규화에 최소값만 넣어 얻는다(축 끝 값을 따로 들고 있지 않게). */
function minMarks(): { protein: number; fat: number } {
  const n = normalizeForRadar({
    ...SKU_NUTRITION.C01,
    protein_pct: FEDIAF_REFERENCE.protein_pct.min,
    fat_pct: FEDIAF_REFERENCE.fat_pct.min,
  })
  return { protein: n['단백'], fat: n['지방'] }
}

function Bar({ label, value, mark, color }: { label: string; value: number; mark: number; color: string }) {
  return (
    <span style={{ display: 'grid', gridTemplateColumns: '52px 1fr', columnGap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      <span style={{ position: 'relative', height: 12, background: '#EFEDEE' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${value}%`, background: color }} />
        <span style={{ position: 'absolute', left: `${mark}%`, top: -3, width: 3, height: 18, background: V3.ink }} />
      </span>
    </span>
  )
}

export default function CompareView({ skus, isApp, siteUrl }: { skus: SkuKey[]; isApp: boolean; siteUrl: string }) {
  const marks = minMarks()
  return (
    // 줄 높이는 시안과 같은 기본값(normal). w-full + min-w-0 — body 가 flex(column) 라 가로가 내용 크기로 부풀지 않게(아래 page.tsx 주석).
    <div className="w-full min-w-0" style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal', wordBreak: 'keep-all' }}>
      <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span aria-hidden style={{ display: 'flex', gap: 3 }}>
          {skus.map((s) => (
            <span key={s} style={{ width: 14, height: 14, background: RECIPE_COLOR[proteinOf(s)] }} />
          ))}
        </span>
        {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>4종 라인 비교</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
          치킨·오리·흑돼지·한우 4종 화식의 단백질·지방·칼슘과 인·오메가3·셀레늄을 한 화면에. 4종 모두 국제 영양 기준을
          충족해요.
        </p>
      </section>

      {/* 영양 비교 — 레시피마다 단백질·지방 막대 + 국제 최소 기준 눈금 */}
      <section
        aria-labelledby="table-title"
        style={{ margin: '28px 20px 0', borderTop: `2px solid ${V3.ink}`, paddingTop: 14, display: 'flex', flexDirection: 'column' }}
      >
        <h2 id="table-title" style={{ margin: 0, fontSize: 22 }}>
          영양 비교
        </h2>
        <span style={{ marginTop: 4, fontSize: 14, color: V3.inkMute }}>수분을 뺀 무게 기준이에요</span>
        <span aria-hidden style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 13, color: V3.inkSoft }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 10, background: '#8A8A8A' }} />
            파머스테일 화식
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 16, background: V3.ink }} />
            국제 최소 기준
          </span>
        </span>

        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
          {skus.map((sku) => {
            const p = proteinOf(sku)
            const n = normalizeForRadar(SKU_NUTRITION[sku])
            const bar = RECIPE_CHIP[p]
            return (
              <div
                key={sku}
                style={{ padding: '14px 0', borderBottom: `1px solid ${V3.rule}`, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {/* 내부 코드(FT-C01)·'novel' 배지 제거 — 고객이 못 알아듣는 말은 쓰지 않는다(사장님 2026-07-14). */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 12, height: 12, background: RECIPE_COLOR[p] }} />
                  <span className="ft-poster" style={{ fontSize: 20 }}>
                    {SKU_META[sku].name_ko}
                  </span>
                </span>
                {/* 보증성분 규칙(2026-07-18): 정확 % 금지 → 막대 길이로만. [[feedback_no_exact_nutrient_percent]] */}
                <Bar label="단백질" value={n['단백']} mark={marks.protein} color={bar} />
                <Bar label="지방" value={n['지방']} mark={marks.fat} color={bar} />
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 13, fontWeight: 700 }}>
                  {['✓ 칼슘·인 안전 범위', '✓ 오메가3 충족', '✓ 셀레늄 충족'].map((t) => (
                    <span
                      key={t}
                      style={{ height: 26, padding: '0 8px', borderRadius: 4, background: V3.soft, display: 'flex', alignItems: 'center' }}
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>

        {/* 국제 기준 — 단백·지방은 '최소'다. 예전엔 '18-35' 처럼 범위로 적어서 우리 수치가 상한을 넘긴 것처럼
            읽혔다. 실제로는 국제 기준이 단백·지방에 상한을 두지 않는다(사장님 2026-07-15 "오히려 우리가 충족을 안 해
            다 오바하지?" → 아니고, 최소치를 넉넉히 넘긴 것). 그래서 눈금은 최소 기준 하나만 긋는다. */}
        <div style={{ marginTop: 16, padding: 16, borderRadius: 4, background: V3.soft, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.5 }}>4종 모두 국제 영양 기준을 충족해요.</strong>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: V3.inkSoft }}>
            단백질과 지방은 <strong style={{ color: V3.ink }}>최소 기준</strong>만 정해져 있어요(상한 없음). 파머스테일 화식이
            기준보다 높은 건 고기가 그만큼 많이 들어가서예요. 과하면 해로운 영양소(비타민 D·셀레늄·칼슘과 인)는 정해진 범위
            안에서 관리하고 있어요.
          </p>
        </div>
        {/* 수치의 출처를 정확히 밝힌다 (사장님 2026-07-15).
            · 옛 문구 "자사 R&D 시제품 분석 결과" 는 **과장**이었다 — 실제로는 레시피 설계값에서 유도한 값이고
              실험실 분석은 출시 후 자가품질검사로 예정돼 있다. 하지도 않은 시험을 했다고 적으면 표시광고 문제가 된다. */}
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: V3.inkMute }}>
          ※ 영양 기준치는 투입되는 각 재료의 영양성분을 분석한 추정치예요. 자사 레시피 명세를 국제 기준과 교차검증했고, 정식
          출시 후 자가품질검사 결과로 갱신해요.
        </p>
      </section>

      {/* 우리 아이에 맞게 골라보기 + 레이더 + 레시피 카드 */}
      <CompareClient skus={skus} isApp={isApp} siteUrl={siteUrl} />

      <p style={{ margin: '24px 20px 0', fontSize: 14, lineHeight: 1.6, color: V3.inkMute, textAlign: 'center' }}>
        설문 결과에 맞춰 자동으로 추천된 레시피가 주문 단계에 그대로 담겨요. 직접 비교해 보고 싶다면 위 차트를 참고하세요.
      </p>
    </div>
  )
}
