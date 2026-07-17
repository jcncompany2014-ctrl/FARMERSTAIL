'use client'

/**
 * Round C1 (2026-05-20): /compare 페이지의 인터랙티브 client 부분.
 *
 *  - 5종 스파이더 (Recharts Radar)
 *  - 페르소나별 추천 selector
 *  - 5종 토글 (개별 on/off)
 */

import { useState, useMemo } from 'react'
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
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { WebRecipe } from '@/lib/web-recipes'

// '노령' 제거 — 연어(EPA/DHA)만 가리키던 칩이라 연어를 뺀 뒤로는 눌러도 고를 게
// 없어 차트가 비었다. 4종으로 답할 수 있는 칩만 둔다(사장님 2026-07-15).
const PERSONA_LABEL: Record<SkuPersona, string> = {
  beginner: '입문',
  diet: '다이어트',
  allergy: '알레르기',
  active: '활동多',
  sensitive: '소화민감',
  palatability: '기호성',
}

// 2026-07-14 사장님: 내부 용어(IgE 진단·Novel protein·매트릭스 등) 제거 —
// 고객이 못 알아듣는 말은 쓰지 않는다.
const PERSONA_HINT: Record<SkuPersona, string> = {
  beginner: '화식이 처음이라면 무난하게 시작하기 좋아요.',
  diet: '체중 관리가 필요한 아이 — 4종 중 지방이 가장 적은 쪽으로.',
  allergy: '알레르기가 있거나 의심되는 아이 — 흔치 않은 단백질로 피해요.',
  active: '산책 1시간 이상, 활동량이 많은 아이.',
  sensitive: '변이 무르거나 토하고, 음식 바꾸면 적응이 어려운 아이.',
  palatability: '밥을 남기거나 입이 짧은 아이 — 풍미가 진한 쪽으로.',
}

// 5종 색상 — Cohort 대시보드와 동일 톤
const SKU_COLORS: Record<SkuKey, string> = {
  C01: '#C76A4E', // terracotta
  D02: '#8BA05A', // moss
  P04: '#A87BA0', // mauve
  B05: '#E0B341', // mustard
}

// SKU → 웹 레시피 단백질 키. "화식 보러가기" → FD식 제품정보 퀵뷰 시트로 연결
// (2026-06-19 사장님 "보러가기 = 페이지 점프 말고 제품정보 퀵바로" — PDP 점프 폐기).
const SKU_RECIPE_PROTEIN: Record<SkuKey, WebRecipe['protein'] | null> = {
  C01: 'chicken',
  D02: 'duck',
  P04: 'pork',
  B05: 'beef',
}

export default function CompareClient({
  skus,
  isApp = false,
  siteUrl = '',
}: {
  skus: SkuKey[]
  /** 앱(PWA/Capacitor) 컨텍스트 — 제품 상세는 앱 안이 아니라 외부 브라우저로
   *  열어야 한다(사장님 2026-07-14 "앱은 앱에서만 놀아야해"). */
  isApp?: boolean
  /** 외부로 열 때 쓸 절대 URL 베이스. */
  siteUrl?: string
}) {
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
      {/* 우리 아이 상황으로 좁히기 (내부 용어 '페르소나' 미노출) */}
      <section className="mt-6 rounded-2xl border border-rule bg-white p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          우리 아이에 맞게 골라보기
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
            영양 한눈에 비교
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {skus.map((sku) => (
              <button
                key={sku}
                onClick={() =>
                  setSelected((prev) => ({ ...prev, [sku]: !prev[sku] }))
                }
                className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-tight transition ${
                  selected[sku]
                    ? 'text-white'
                    : 'bg-bg text-muted hover:text-text'
                }`}
                style={
                  selected[sku] ? { background: SKU_COLORS[sku] } : undefined
                }
              >
                {SKU_META[sku].name_ko}
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
                    name={SKU_META[sku].name_ko}
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
        {/* 옛 문구: "100 = FEDIAF 권장 상한" — 거짓이다. 축 상한(RADAR_AXIS_MAX)은
            FEDIAF 가 아니라 우리 제품군 분포(단백 55·지방 32)다. 단백·지방엔
            애초에 FEDIAF 상한이 없다. 이 문구가 "우리가 기준을 초과했다"는
            오해를 부추겼다(사장님 2026-07-15). */}
        <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
          ※ 4종끼리 비교하기 쉽게 축마다 0-100 으로 바꾼 상대값이에요. 국제 영양
          기준 대비 실제 수치는 위 표에서 확인해 주세요.
        </p>
      </section>

      {/* SKU 카드 */}
      <section className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {skus
          .filter((sku) => selected[sku])
          .map((sku) => {
            const meta = SKU_META[sku]
            const nutrition = SKU_NUTRITION[sku]
            const recipeProtein = SKU_RECIPE_PROTEIN[sku]
            return (
              <article
                key={sku}
                className="rounded-2xl border border-rule bg-white p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  {/* 이름을 원 안에 넣으면 '흑돼지' 3글자가 끼어 뭉갠다 →
                      색만 남기고 이름은 제목 한 곳에서만 읽히게. */}
                  <div
                    className="shrink-0 w-3 h-3 mt-1 rounded-full"
                    style={{ background: SKU_COLORS[sku] }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold text-ink">
                      {meta.name_ko} 화식
                      {meta.novel && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight text-moss bg-moss/10">
                          흔치 않은 단백질
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
                {/* 2026-07-14 사장님: 퀵뷰 시트 → 제품 QR 상세페이지(/recipe/
                    {protein})로 연결. 인쇄물 QR 과 같은 페이지 = 단일 진실.
                    ⚠️ 앱에선 그 웹 페이지가 앱 안에서 열리면 안 된다 → 절대
                    URL + target=_blank 로 외부 브라우저에서 열기. */}
                {recipeProtein ? (
                  isApp ? (
                    <a
                      href={`${siteUrl}/recipe/${recipeProtein}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 rounded-full bg-ink py-2.5 text-[12px] font-bold text-white transition active:scale-[0.98] hover:opacity-90"
                    >
                      {meta.name_ko} 화식 보러가기
                      <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
                    </a>
                  ) : (
                    <Link
                      href={`/recipe/${recipeProtein}`}
                      className="flex items-center justify-center gap-1 rounded-full bg-ink py-2.5 text-[12px] font-bold text-white transition active:scale-[0.98] hover:opacity-90"
                    >
                      {meta.name_ko} 화식 보러가기
                      <span aria-hidden>→</span>
                    </Link>
                  )
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
