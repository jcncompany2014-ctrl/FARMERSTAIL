'use client'

/**
 * Round C1 (2026-05-20): /compare 페이지의 인터랙티브 client 부분.
 *
 *  - 4종 레이더(거미줄) 비교
 *  - 페르소나별 추천 selector
 *  - 4종 토글 (개별 on/off)
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A10): 알약 칩 → 48px 네모 버튼, 둥근 흰 카드 → 먹선 2px 로 여는 묶음.
 *   레이더는 차트 라이브러리 대신 시안과 같은 SVG 로 직접 그린다 — 값은 같은 정본 정규화(normalizeForRadar).
 *   축 이름: 'Ca:P'·'EPA+DHA'·'Se' → 칼슘·인 · 오메가3 · 셀레늄(영문 약어 빼기). '활동多' → '활동 많음'.
 *   레시피 카드: 회색 면 + 왼쪽 6px 띠, "○○ 화식 보러가기"는 흰 바탕 먹선 버튼.
 */

import { useState } from 'react'
import {
  SKU_NUTRITION,
  normalizeForRadar,
  recommendByPersona,
  type SkuPersona,
} from '@/lib/sku-nutrition-matrix'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import Link from 'next/link'
import type { WebRecipe } from '@/lib/web-recipes'
import { V3 } from '@/lib/design/tokens'
import { RECIPE_COLOR } from '@/components/analysis/display'
import type { ProteinKey } from '@/lib/personalization/skuModel'

// '노령' 제거 — 연어(EPA/DHA)만 가리키던 칩이라 연어를 뺀 뒤로는 눌러도 고를 게
// 없어 차트가 비었다. 4종으로 답할 수 있는 칩만 둔다(사장님 2026-07-15).
const PERSONA_LABEL: Record<SkuPersona, string> = {
  beginner: '입문',
  diet: '다이어트',
  allergy: '알레르기',
  active: '활동 많음',
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

// SKU → 웹 레시피 단백질 키. "화식 보러가기" → 제품 QR 상세페이지(/recipe/{protein}).
const SKU_RECIPE_PROTEIN: Record<SkuKey, WebRecipe['protein'] | null> = {
  C01: 'chicken',
  D02: 'duck',
  P04: 'pork',
  B05: 'beef',
}

function colorOf(sku: SkuKey): string {
  return RECIPE_COLOR[SKU_META[sku].protein_en as ProteinKey]
}

/** 레이더 축 — 정규화 키 → 화면 이름(시안 A10). */
const AXES = [
  ['단백', '단백질'],
  ['지방', '지방'],
  ['Ca:P', '칼슘·인'],
  ['EPA+DHA', '오메가3'],
  ['Se', '셀레늄'],
] as const

// 시안 A10 의 레이더 판 — 가운데 (175,150), 반지름 120, 맨 위에서 시계방향 72° 씩. 눈금 4겹(25·50·75·100%).
const CX = 175
const CY = 150
const R = 120
function pt(axis: number, ratio: number): [number, number] {
  const a = ((-90 + axis * 72) * Math.PI) / 180
  return [+(CX + Math.cos(a) * R * ratio).toFixed(1), +(CY + Math.sin(a) * R * ratio).toFixed(1)]
}
const LABEL_POS: Array<{ x: number; y: number; anchor: 'middle' | 'start' | 'end' }> = [
  { x: 175, y: 20, anchor: 'middle' },
  { x: 300, y: 110, anchor: 'start' },
  { x: 254, y: 270, anchor: 'middle' },
  { x: 96, y: 270, anchor: 'middle' },
  { x: 50, y: 110, anchor: 'end' },
]

function Radar({ skus }: { skus: SkuKey[] }) {
  const rings = [1, 0.75, 0.5, 0.25]
  return (
    <svg viewBox="0 0 350 285" role="img" aria-label="4종 영양 비교 그래프" style={{ display: 'block', width: '100%', height: 'auto', marginTop: 14 }}>
      <g fill="none" stroke={V3.rule} strokeWidth={1}>
        {rings.map((r) => (
          <polygon key={r} points={AXES.map((_, i) => pt(i, r).join(',')).join(' ')} />
        ))}
        <path d={AXES.map((_, i) => `M${CX} ${CY}L${pt(i, 1).join(' ')}`).join('')} />
      </g>
      {/* 첫 레시피(닭)가 맨 위에 오도록 거꾸로 그린다. */}
      {[...skus].reverse().map((sku) => {
        const n = normalizeForRadar(SKU_NUTRITION[sku])
        const c = colorOf(sku)
        const first = sku === skus[0]
        return (
          <polygon
            key={sku}
            points={AXES.map(([k], i) => pt(i, n[k] / 100).join(',')).join(' ')}
            fill={c}
            fillOpacity={first ? 0.1 : 0.08}
            stroke={c}
            strokeWidth={first ? 2.5 : 2}
            strokeLinejoin="round"
          />
        )
      })}
      <g fontSize={14} fontWeight={700} fill={V3.ink}>
        {AXES.map(([, label], i) => (
          <text key={label} x={LABEL_POS[i]!.x} y={LABEL_POS[i]!.y} textAnchor={LABEL_POS[i]!.anchor}>
            {label}
          </text>
        ))}
      </g>
    </svg>
  )
}

const SECTION = {
  margin: '30px 20px 0',
  borderTop: `2px solid ${V3.ink}`,
  paddingTop: 14,
  display: 'flex',
  flexDirection: 'column',
} as const

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

  const shown = skus.filter((sku) => selected[sku])

  return (
    <>
      {/* 우리 아이 상황으로 좁히기 (내부 용어 '페르소나' 미노출) */}
      <section aria-labelledby="pick-title" style={SECTION}>
        <h2 id="pick-title" style={{ margin: 0, fontSize: 22 }}>
          우리 아이에 맞게 골라보기
        </h2>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(PERSONA_LABEL) as SkuPersona[]).map((p) => {
            const on = persona === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => pickPersona(p)}
                aria-pressed={on}
                className="ft-no-press"
                style={{
                  height: 48,
                  padding: '0 16px',
                  border: `1.5px solid ${V3.ink}`,
                  borderRadius: 4,
                  background: on ? V3.ink : '#FFFFFF',
                  color: on ? '#FFFFFF' : V3.ink,
                  fontSize: 16,
                  fontWeight: on ? 800 : 700,
                  cursor: 'pointer',
                }}
              >
                {PERSONA_LABEL[p]}
              </button>
            )
          })}
        </div>
        {persona && (
          <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: V3.inkSoft }}>{PERSONA_HINT[persona]}</p>
        )}
      </section>

      {/* 4종 레이더 */}
      <section aria-labelledby="radar-title" style={SECTION}>
        <h2 id="radar-title" style={{ margin: 0, fontSize: 22 }}>
          영양 한눈에 비교
        </h2>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skus.map((sku) => {
            const on = selected[sku]
            const c = colorOf(sku)
            return (
              <button
                key={sku}
                type="button"
                onClick={() => setSelected((prev) => ({ ...prev, [sku]: !prev[sku] }))}
                aria-pressed={on}
                className="ft-no-press"
                style={{
                  height: 44,
                  padding: '0 14px',
                  border: on ? `1.5px solid ${c}` : '1.5px solid #D5D3D4',
                  borderRadius: 4,
                  background: on ? c : '#FFFFFF',
                  // 닭(머스타드) 바탕만 먹색 글자 — 나머지 진한 색 바탕은 흰 글자.
                  color: on ? (sku === 'C01' ? V3.ink : '#FFFFFF') : V3.inkMute,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {SKU_META[sku].name_ko}
              </button>
            )
          })}
        </div>

        <Radar skus={shown} />
        <span aria-hidden style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, fontSize: 14, color: V3.inkSoft }}>
          {shown.map((sku) => (
            <span key={sku} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: colorOf(sku) }} />
              {SKU_META[sku].name_ko}
            </span>
          ))}
        </span>
        {/* 옛 문구: "100 = FEDIAF 권장 상한" — 거짓이다. 축 상한(RADAR_AXIS_MAX)은
            국제 기준이 아니라 우리 제품군 분포(단백 55·지방 32)다. 단백·지방엔
            애초에 상한이 없다. 이 문구가 "우리가 기준을 초과했다"는
            오해를 부추겼다(사장님 2026-07-15). */}
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: V3.inkMute }}>
          ※ 4종끼리 비교하기 쉽게 축마다 바꾼 상대값이에요. 국제 영양 기준과 비교한 모습은 위 영양 비교에서 확인해 주세요.
        </p>
      </section>

      {/* 레시피 카드 */}
      <section aria-label="레시피 4종" style={{ margin: '30px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((sku) => {
          const meta = SKU_META[sku]
          const nutrition = SKU_NUTRITION[sku]
          const recipeProtein = SKU_RECIPE_PROTEIN[sku]
          const linkStyle = {
            height: 52,
            boxSizing: 'border-box' as const,
            borderRadius: 4,
            border: `1.5px solid ${V3.ink}`,
            color: V3.ink,
            fontSize: 16,
            fontWeight: 800,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }
          return (
            <article
              key={sku}
              style={{
                padding: 16,
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: V3.soft,
                borderLeft: `6px solid ${V3.mustard}`,
              }}
            >
              {/* 이름을 원 안에 넣으면 '흑돼지' 3글자가 끼어 뭉갠다 → 색만 남기고 이름은 제목 한 곳에서만 읽히게. */}
              <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span aria-hidden style={{ width: 12, height: 12, background: colorOf(sku) }} />
                <h3 className="ft-poster" style={{ margin: 0, fontSize: 21 }}>
                  {meta.name_ko} 화식
                </h3>
                {meta.novel && (
                  <span
                    style={{
                      height: 24,
                      padding: '0 7px',
                      boxSizing: 'border-box',
                      borderRadius: 4,
                      border: `1.5px solid ${V3.ink}`,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    흔치 않은 단백질
                  </span>
                )}
              </span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: V3.inkSoft }}>{nutrition.highlight_ko}</p>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {nutrition.persona.map((p) => (
                  <span
                    key={p}
                    style={{ height: 26, padding: '0 8px', borderRadius: 4, background: '#FFFFFF', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' }}
                  >
                    {PERSONA_LABEL[p]}
                  </span>
                ))}
              </span>
              {/* 2026-07-14 사장님: 퀵뷰 시트 → 제품 QR 상세페이지(/recipe/{protein})로 연결. 인쇄물 QR 과 같은 페이지 = 단일 진실.
                  ⚠️ 앱에선 그 웹 페이지가 앱 안에서 열리면 안 된다 → 절대 URL + target=_blank 로 외부 브라우저에서 열기. */}
              {recipeProtein ? (
                isApp ? (
                  <a href={`${siteUrl}/recipe/${recipeProtein}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {meta.name_ko} 화식 보러가기
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                    </svg>
                  </a>
                ) : (
                  <Link href={`/recipe/${recipeProtein}`} style={linkStyle}>
                    {meta.name_ko} 화식 보러가기
                    <span aria-hidden>→</span>
                  </Link>
                )
              ) : (
                <div style={{ ...linkStyle, border: 0, background: '#FFFFFF', color: V3.inkMute }}>출시 예정</div>
              )}
            </article>
          )
        })}
      </section>
    </>
  )
}
