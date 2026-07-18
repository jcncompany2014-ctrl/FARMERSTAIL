'use client'

/**
 * PlanClient — 상품(플랜) 페이지 본체 (2026-07-13 사장님, 목업 확정 + 구조 개편).
 *
 * TFD "Build a Plan" + 우리 차별점(알고리즘 임상 안전성). 사장님 개편 지시:
 *  - 연어(salmon/skin) 레시피 아예 제거 — 레시피 4종(닭/오리/돼지/소)만.
 *  - 추천을 **위쪽에 강조(강화)** 해서 먼저 보여주고, **아래에 "다른 레시피"
 *    바꾸기 목록**을 둔다. 단일 단백질 추천이면 그 하나가 크게.
 *  - 알레르기 차단 라인은 잠금.
 *  - 화식 비율(곁들임/반반/완전) + 첫박스 할인.
 *
 * # Phase 1.5 (현재)
 *  실제 재료 반영(사장님 배합표). CTA → /order. 선택 handoff·실제 가격 정합·
 *  결과지 슬림화·실사 사진은 후속.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Plus, Lock, AlertTriangle, ChevronRight, Info } from 'lucide-react'
import { petName } from '@/lib/korean'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { FOOD_LINE_META } from '@/lib/personalization/lines'
import { LINE_TO_SLUG } from '@/lib/personalization/skuMap'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'
import { snapBoxLines } from '@/lib/personalization/boxComposition'
import { fetchComputedFormula } from '@/lib/personalization/formulaCache'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { FRESH_TIERS, type FreshRatio } from '@/lib/subscription/freshTier'

export type PlanProduct = {
  slug: string
  price: number
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
}

// 연어(skin) 제외 — 사장님 2026-07-13. 표시 순서: 닭·소·오리·돼지.
// (line→단백질: weight=닭, premium=소, basic=오리, joint=돼지)
const RECIPE_LINES: FoodLine[] = ['weight', 'premium', 'basic', 'joint']

// 실제 재료 (사장님 배합표 2026-07-13). main=메인 단백질, organs=내장,
// toppings=컨셉 토핑, veg=채소·탄수. 카드에는 main+organs+toppings 만,
// 전체(+veg·오일)는 "재료 전체" 상세에서. (소는 내장도 한우 표기 — 사장님)
const RECIPES: Record<string, { main: string; organs: string[]; toppings: string[]; veg: string[] }> = {
  weight: { main: '닭가슴살', organs: ['닭간', '닭심장'], toppings: ['브로콜리', '블루베리'], veg: ['당근', '단호박', '시금치', '현미', '고구마'] },
  premium: { main: '한우 목심', organs: ['한우 간', '한우 심장'], toppings: ['비트', '블루베리'], veg: ['당근', '단호박', '시금치', '현미', '고구마'] },
  basic: { main: '오리 안심', organs: ['오리 간', '오리 심장'], toppings: ['애호박', '사과'], veg: ['당근', '단호박', '시금치', '현미', '고구마'] },
  joint: { main: '돼지 안심', organs: ['돼지 간', '돼지 심장'], toppings: ['무', '양배추'], veg: ['당근', '단호박', '시금치', '현미', '고구마'] },
}
/** 카드 노출용 — 메인 단백질 + 내장 + 컨셉 토핑. */
function cardIngredients(line: string): string[] {
  const r = RECIPES[line]
  return r ? [r.main, ...r.organs, ...r.toppings] : []
}
/** 상세 시트용 — 전체 재료 (+채소·탄수·오일·프리믹스). */
function fullIngredients(line: string): string[] {
  const r = RECIPES[line]
  return r
    ? [r.main, ...r.organs, ...r.veg, ...r.toppings, '올리브유', '연어유', '강황', '프리믹스 분말', '정제수']
    : []
}

// 등록성분(as-fed 보장분석, 사장님 표 2026-07-13). line→단백질: weight=닭·basic=오리·
// joint=돼지(흑돼지)·premium=소(한우). 제조국가 전부 한국.
const RECIPE_NUTRITION: Record<
  string,
  { protein: number; fat: number; fiber: number; ash: number; moisture: number; calcium: number; phosphorus: number }
> = {
  weight: { protein: 15.1, fat: 4.7, fiber: 0.3, ash: 2.2, moisture: 75.2, calcium: 0.3, phosphorus: 0.3 },
  basic: { protein: 13.1, fat: 5.2, fiber: 0.3, ash: 2.1, moisture: 76.3, calcium: 0.3, phosphorus: 0.3 },
  joint: { protein: 14.9, fat: 5.4, fiber: 0.2, ash: 2.1, moisture: 76.1, calcium: 0.3, phosphorus: 0.3 },
  premium: { protein: 13.9, fat: 5.5, fiber: 0.3, ash: 2.1, moisture: 75.1, calcium: 0.3, phosphorus: 0.3 },
}

// 레시피별 고객용 설명 — "이건 이래서 좋아요"(사장님 2026-07-13).
const RECIPE_DESCRIPTIONS: Record<string, string> = {
  weight:
    '네 가지 중 가장 순하고 소화가 편한 단백질이에요. 지방이 낮아 체중 관리가 필요한 아이에게 특히 잘 맞고, 담백해서 화식을 처음 시작하는 아이도 부담 없이 먹어요. 무항생제 닭가슴살을 메인으로 씁니다.',
  premium:
    '고단백에 헴철분이 풍부해 활동량 많은 아이, 근육과 활력이 필요한 아이에게 좋아요. 진한 풍미라 입이 짧은 아이도 잘 먹어요. 프리미엄 한우 목심을 저지방으로 손질해 담습니다.',
  basic:
    '닭·소가 잘 안 맞는 아이도 편하게 먹는 노블 단백질이에요. 흔한 알레르겐이 아니라 부담이 낮으면서도, 담백한 감칠맛이 있어 기호성이 좋아요. 무항생제 오리 안심을 씁니다.',
  joint:
    '예민한 아이에게 부드러운 저알러지 단백질이에요. 소화가 편하고, 제주산 흑돼지 특유의 고소한 풍미로 잘 먹어요. 지방이 적은 안심 부위를 메인으로 담습니다.',
}

// 레시피 제목 (사장님 지정 2026-07-13). line→단백질: weight=닭·premium=소·basic=오리·joint=돼지.
const RECIPE_TITLES: Record<string, string> = {
  weight: 'CHICKEN · 무항생제 닭',
  premium: 'BEEF · 프리미엄 한우',
  basic: 'DUCK · 무항생제 오리',
  joint: 'PORK · 제주산 흑돼지',
}

// 레시피(단백질) 특성 → 편익 한 줄. 추천 카드의 "추천 이유"에 그 아이의 근거
// (트리거)와 결합해 노출 — "체중 관리 · 저지방 닭가슴살이라…" 식(사장님 2026-07-14).
const RECIPE_WHY: Record<string, string> = {
  weight: '단백질이 진한 닭가슴살이라 근육 지키며 체중 관리에 좋아요',
  premium: '고단백·헴철분이 풍부해 활력과 근육에 좋아요',
  basic: '흔한 알레르겐이 아니라 예민한 속에도 부담이 적어요',
  joint: '저지방 흑돼지 안심이라 부드럽고 소화가 편해요',
}

// 플랜 = 실제로 고르는 상품 페이지라 '자세하게'(배지·설명·안내). 분석 결과지는
// 반대로 컴팩트 — 역할 분담(사장님 2026-07-14). 카피는 결과지와 동일 문구.
// 티어 정의는 정본 lib/subscription/freshTier (FRESH_TIERS). 3화면 공유.

const MAX_RECIPES = 2

/** 배송·결제 사이클 = 2주(14일) 고정. 결제 바의 '총가격' 산정 기준. */
const CYCLE_DAYS = 14

// 블랭킷 첫주문 50% 폐지(2026-07-17 사장님). 할인 규칙: 기본 구독 15%(전원) +
// 나무 등급만 추가 10% + 그 외(50% 등)는 이벤트 페이지 신규가입자만·admin 설정.
// 등급·이벤트 할인은 계정 조건이라 결제 시 자동 적용되고, 이 플랜 화면은 기본 구독가만
// 보여준다(청구측 lib/discount 는 이미 이 규칙과 일치).

/** reasoning ruleId → 그 룰이 강조한 단백질 라인. "왜 이 레시피" 매핑용. */
function lineFromRuleId(ruleId: string): FoodLine | null {
  if (ruleId === 'goal-weight_management') return 'weight'
  if (ruleId === 'goal-skin_coat') return 'skin'
  if (ruleId === 'goal-joint_senior') return 'joint'
  if (ruleId === 'goal-general_upgrade' || ruleId === 'goal-allergy_avoid') return 'basic'
  if (ruleId === 'bcs-overweight' || ruleId === 'bcs-obese') return 'weight'
  if (ruleId === 'bcs-refeeding-risk' || ruleId === 'bcs-underweight') return 'premium'
  if (ruleId === 'chronic-arthritis' || ruleId === 'chronic-long-term-steroid') return 'joint'
  if (ruleId === 'chronic-allergy-skin' || ruleId === 'chronic-cognitive-decline') return 'skin'
  if (
    ruleId === 'chronic-diabetes' ||
    ruleId === 'chronic-hypothyroid' ||
    ruleId === 'chronic-cushings' ||
    ruleId === 'chronic-musculoskeletal'
  )
    return 'weight'
  if (ruleId === 'chronic-epi') return 'premium'
  if (ruleId === 'age-senior-joint') return 'joint'
  if (ruleId === 'age-puppy' || ruleId === 'age-puppy-large-breed') return 'basic'
  return null
}

/** 이 라인을 추천한 가장 중요한 근거(trigger). 없으면 null → 호출부가 benefit 폴백. */
function whyForLine(line: FoodLine, reasoning: Formula['reasoning']): string | null {
  const matched = reasoning
    .filter((r) => lineFromRuleId(r.ruleId) === line)
    .sort((a, b) => a.priority - b.priority)
  return matched[0]?.trigger ?? null
}

/**
 * 데이터 래퍼 — 분석 결과지와 **동일한 소스**(계산 API의 cycle 1)를 탄다.
 * 이전엔 서버가 dog_formulas 의 최신 cycle 을 직접 읽어서 분석(cycle 1·재계산)
 * 과 추천이 어긋났다(사장님 2026-07-14 "분석은 닭 100% 인데 플랜은 다른 걸").
 * fetchComputedFormula 는 AnalysisView·RecommendationBox 와 캐시를 공유하므로
 * 중복 POST 도 없다.
 */
export default function PlanClient({
  dogId,
  dogName,
  products,
  initialFresh,
}: {
  dogId: string
  dogName: string
  products: Record<string, PlanProduct>
  initialFresh: number
}) {
  const [state, setState] = useState<
    { s: 'loading' } | { s: 'ready'; formula: Formula } | { s: 'empty' }
  >({ s: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { httpOk, body } = await fetchComputedFormula(dogId, 1)
        if (cancelled) return
        if (!httpOk || !('ok' in body) || body.ok !== true) {
          setState({ s: 'empty' })
          return
        }
        setState({ s: 'ready', formula: body.formula })
      } catch {
        if (!cancelled) setState({ s: 'empty' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId])

  if (state.s === 'loading') {
    return (
      <div style={{ padding: '14px 14px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-6 w-52 mx-auto" />
          <Skeleton className="h-28 w-full mt-2" rounded="lg" />
          <Skeleton className="h-28 w-full" rounded="lg" />
          <Skeleton className="h-24 w-full" rounded="lg" />
        </div>
      </div>
    )
  }

  if (state.s === 'empty') {
    return (
      <div className="px-5 py-16 text-center">
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
          아직 맞춤 결과가 없어요
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 16px' }}>
          분석을 먼저 받으면 {petName(dogName)}에게 맞는 레시피를 추천해 드려요.
        </p>
        <Link href={`/dogs/${dogId}/analysis`} style={ctaLink()}>
          분석 보러가기 <ArrowRight size={13} strokeWidth={2.4} />
        </Link>
      </div>
    )
  }

  return (
    <PlanView
      dogId={dogId}
      dogName={dogName}
      formula={state.formula}
      products={products}
      initialFresh={initialFresh}
    />
  )
}

/** 플랜 본체 — formula 확정 후 렌더. 선택 상태는 이 시점 추천으로 초기화된다. */
function PlanView({
  dogId,
  dogName,
  formula,
  products,
  initialFresh,
}: {
  dogId: string
  dogName: string
  formula: Formula
  products: Record<string, PlanProduct>
  initialFresh: number
}) {
  const [freshRatio, setFreshRatio] = useState<FreshRatio>(
    initialFresh === 60 ? 60 : initialFresh === 100 ? 100 : 30,
  )
  // 재료 전체·영양성분 바텀시트 — 어떤 레시피를 펼쳤는지.
  const [detailLine, setDetailLine] = useState<FoodLine | null>(null)

  // 추천 = snapBoxLines(임상 비율, 연어 제외) 상위 ≤2종. 잠금 = 알레르기 차단.
  const recommended = new Set<FoodLine>(
    formula
      ? snapBoxLines({ ...formula.lineRatios, skin: 0 }).map((x) => x.line)
      : [],
  )
  const blocked = new Set<FoodLine>()
  if (formula) {
    for (const r of formula.reasoning) {
      const m = r.ruleId.match(/^(?:next-)?allergy-(basic|weight|skin|premium|joint)$/)
      if (m) blocked.add(m[1] as FoodLine)
    }
  }

  const [selected, setSelected] = useState<Set<FoodLine>>(() => {
    const init = new Set<FoodLine>([...recommended].filter((l) => l !== 'skin'))
    // 추천이 비면(전부 차단 등) 첫 가용 레시피로 안전 폴백.
    if (init.size === 0) {
      const fallback = RECIPE_LINES.find((l) => !blocked.has(l))
      if (fallback) init.add(fallback)
    }
    return init
  })

  function add(line: FoodLine) {
    if (blocked.has(line)) return
    setSelected((prev) => {
      if (prev.has(line) || prev.size >= MAX_RECIPES) return prev
      return new Set(prev).add(line)
    })
  }
  function remove(line: FoodLine) {
    setSelected((prev) => {
      if (!prev.has(line) || prev.size <= 1) return prev
      const next = new Set(prev)
      next.delete(line)
      return next
    })
  }

  // 대표 일일 가격 — 선택 라인 50:50(2종)/100%(1종) × 화식 비율.
  const freshFactor = freshRatio / 100
  const perLineRatio = selected.size === 2 ? 0.5 : 1
  // dailyList = 정가 기준, dailyRegular = 구독가(정가 −15%, products.sale_price).
  // 표시는 기본 구독가만 — 나무 등급 +10%·이벤트(신규가입) 할인은 계정 조건이라
  // 결제 시 자동 적용된다(2026-07-17: 블랭킷 첫주문 50% 폐지).
  let dailyList = 0
  let dailyRegular = 0
  if (formula) {
    for (const line of selected) {
      const slug = LINE_TO_SLUG[line]
      const product = slug ? products[slug] : undefined
      if (!product) continue
      const kcalPer100g = FOOD_LINE_META[line].kcalPer100g
      const dailyG = ((perLineRatio * formula.dailyKcal) / kcalPer100g) * 100 * freshFactor
      const unitPrice = product.sale_price ?? product.price
      dailyList += (dailyG / 100) * product.price
      dailyRegular += (dailyG / 100) * unitPrice
    }
  }
  const dailyPay = Math.round(dailyRegular / 10) * 10
  // 2주(14일) 사이클 총액 — 하단 결제 바 '총가격'. 취소선 앵커 = 정가(구독가와 비교).
  const cyclePay = Math.round((dailyRegular * CYCLE_DAYS) / 10) * 10
  const cycleList = Math.round((dailyList * CYCLE_DAYS) / 10) * 10
  const cycleAnchor = cycleList
  const offLabel = `구독 ${SUBSCRIPTION_DISCOUNT_PCT}%`

  const others = RECIPE_LINES.filter((l) => !selected.has(l))
  const canAddMore = selected.size < MAX_RECIPES

  return (
    <div style={{ padding: '14px 14px 96px', position: 'relative' }}>
      {/* 스텝 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
        <span style={{ color: 'var(--terracotta)' }}>① 레시피</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span>② 배송</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span>③ 결제</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.2em', color: 'var(--terracotta)' }}>
          MADE FOR {dogName.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 3, color: 'var(--ink)' }}>
          이 레시피를 추천해요
        </h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 11, flexWrap: 'wrap' }}>
        {['수의영양학', 'AAFCO·FEDIAF 충족', '사람도 먹는 등급'].map((t) => (
          <span key={t} style={{ fontSize: 9.5, color: 'var(--moss, #4f6a48)', background: 'color-mix(in srgb, var(--moss, #4f6a48) 9%, transparent)', padding: '3px 8px', borderRadius: 99, fontWeight: 600 }}>
            {t}
          </span>
        ))}
      </div>

      {/* ── 위: 내 플랜 (추천 강조) ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          {petName(dogName)}의 플랜
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
          {selected.size}가지 · 최대 {MAX_RECIPES}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...selected].map((line) => (
          <HeroCard
            key={line}
            line={line}
            isRec={recommended.has(line)}
            why={whyForLine(line, formula.reasoning) ?? ''}
            removable={selected.size > 1}
            onRemove={() => remove(line)}
            onDetail={() => setDetailLine(line)}
          />
        ))}
      </div>

      {/* ── 아래: 다른 레시피로 바꾸기 ───────────────────────────── */}
      {others.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginTop: 20, marginBottom: 8 }}>
            다른 레시피로 바꾸기
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {others.map((line) => {
              const meta = FOOD_LINE_META[line]
              const isBlocked = blocked.has(line)
              const isRec = recommended.has(line)
              return (
                <div
                  key={line}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: isBlocked ? 'var(--bg-2)' : 'var(--surface-card-elevated, #fff)',
                    border: isBlocked ? '1px dashed var(--rule)' : '1px solid var(--rule)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    opacity: isBlocked ? 0.8 : 1,
                  }}
                >
                  <div style={miniCircle(isBlocked ? 'rgba(120,120,120,.1)' : `color-mix(in srgb, ${meta.color} 13%, transparent)`)}>
                    {isBlocked ? <Lock size={17} strokeWidth={2} color="var(--muted)" /> : <span style={{ fontSize: 19 }} aria-hidden>🍲</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isBlocked ? 'var(--muted)' : 'var(--ink)' }}>{RECIPE_TITLES[line] ?? meta.name}</span>
                      {isRec && !isBlocked && (
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--moss, #4f6a48)' }}>★ 추천</span>
                      )}
                    </div>
                    {isBlocked ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--terracotta)', fontWeight: 700, marginTop: 2 }}>
                        <AlertTriangle size={11} strokeWidth={2.2} />알레르기로 제외
                      </span>
                    ) : (
                      <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cardIngredients(line).slice(0, 4).join(', ')}…
                      </div>
                    )}
                  </div>
                  {!isBlocked && (
                    <button
                      type="button"
                      onClick={() => add(line)}
                      disabled={!canAddMore}
                      style={{
                        appearance: 'none',
                        cursor: canAddMore ? 'pointer' : 'default',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        color: canAddMore ? 'var(--ink)' : 'var(--muted)',
                        background: 'transparent',
                        border: '1px solid var(--rule)',
                        opacity: canAddMore ? 1 : 0.5,
                        padding: '6px 13px',
                        borderRadius: 99,
                      }}
                    >
                      <Plus size={13} strokeWidth={2.4} />
                      {canAddMore ? '담기' : '가득'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {!canAddMore && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
              최대 {MAX_RECIPES}가지예요 · 바꾸려면 위에서 하나 빼주세요
            </div>
          )}
        </>
      )}

      {/* 화식 비율 */}
      <div style={{ marginTop: 18, background: 'var(--surface-card-elevated, #fff)', border: '1px solid var(--rule)', borderRadius: 14, padding: 13 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>얼마나 화식으로 드릴까요?</div>
        <div
          role="radiogroup"
          aria-label="화식 비율 선택"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}
        >
          {FRESH_TIERS.map((t) => {
            const on = freshRatio === t.ratio
            return (
              <button
                key={t.ratio}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFreshRatio(t.ratio)}
                style={{
                  appearance: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: on
                    ? 'color-mix(in srgb, var(--terracotta) 4%, transparent)'
                    : 'transparent',
                  border: on ? '2px solid var(--terracotta)' : '1px solid var(--rule)',
                  borderRadius: 12,
                  padding: on ? '11px 12px' : '12px 13px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    {t.label}
                  </span>
                  {'badge' in t && t.badge && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#fff',
                        background: 'var(--terracotta)',
                        padding: '2px 7px',
                        borderRadius: 99,
                      }}
                    >
                      {t.badge}
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      fontWeight: 700,
                      color: on ? 'var(--terracotta)' : 'var(--muted)',
                      flexShrink: 0,
                    }}
                  >
                    {t.sub}
                  </span>
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11.5,
                    color: on
                      ? 'color-mix(in srgb, var(--terracotta) 68%, var(--ink))'
                      : 'var(--muted)',
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {t.copy}
                </span>
                {'note' in t && t.note && (
                  <span
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginTop: 9,
                      paddingTop: 9,
                      borderTop:
                        '1px solid color-mix(in srgb, var(--terracotta) 15%, transparent)',
                      color: 'var(--muted)',
                      fontSize: 10.5,
                      lineHeight: 1.5,
                    }}
                  >
                    <Info
                      size={12}
                      strokeWidth={2}
                      color="var(--terracotta)"
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                    {t.note}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 하루 단가 — 하단 결제 바는 '총가격'이라, 하루 얼마인지는 여기에서
            보여준다(사장님 2026-07-14). 비율 바꾸면 같이 갱신. */}
        {dailyPay > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 5,
              marginTop: 12,
              paddingTop: 11,
              borderTop: '1px solid var(--rule)',
              fontSize: 11.5,
              color: 'var(--muted)',
              fontWeight: 600,
            }}
          >
            하루
            <strong
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {dailyPay.toLocaleString()}원
            </strong>
            <span>· 구독가 기준</span>
          </div>
        )}
      </div>

      {/* 결제 바 (다크) — 총가격(2주). 상세 시트 열리면 숨김(시트 밑으로
          비쳐 보이는 문제 방지). */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--ink)', padding: '13px 16px calc(13px + env(safe-area-inset-bottom))', display: detailLine ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, zIndex: 40 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            2주마다 배송 · 언제든 해지
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            {cycleAnchor > cyclePay && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>{cycleAnchor.toLocaleString()}원</span>
            )}
            <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>
              {cyclePay.toLocaleString()}원<span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>/2주</span>
            </span>
            {cycleAnchor > cyclePay && (
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink)', background: '#E8B84B', padding: '2px 6px', borderRadius: 99 }}>{offLabel}</span>
            )}
          </div>
        </div>
        <Link href={`/dogs/${dogId}/order?fresh=${freshRatio}&recipes=${[...selected].join(',')}`} style={{ border: 'none', background: 'var(--terracotta)', color: '#fff', borderRadius: 99, padding: '12px 18px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
          플랜 담기 <ArrowRight size={15} strokeWidth={2.4} color="#fff" />
        </Link>
      </div>

      {/* 재료 전체·영양성분 — 밑에서 올라오는 바텀시트(70vh). */}
      <BottomSheet
        open={detailLine !== null}
        onClose={() => setDetailLine(null)}
        title={detailLine ? (RECIPE_TITLES[detailLine] ?? '') : ''}
        showClose
        maxHeight="88vh"
      >
        <BottomSheet.Body>
          {detailLine && (
            <RecipeDetail
              line={detailLine}
              dogName={dogName}
              why={
                recommended.has(detailLine)
                  ? (whyForLine(detailLine, formula.reasoning) ?? '')
                  : ''
              }
            />
          )}
        </BottomSheet.Body>
      </BottomSheet>
    </div>
  )
}

/** 레시피 상세 — 전체 재료 + 영양성분(100g 기준). */
function RecipeDetail({
  line,
  dogName,
  why,
}: {
  line: FoodLine
  dogName: string
  why: string
}) {
  const meta = FOOD_LINE_META[line]
  const ings = fullIngredients(line)
  // 근거 trigger 앞 기술 접두사 정리(고객 가독성).
  const whyClean = why.replace(/^케어 목표\s*=\s*/, '')
  const n = RECIPE_NUTRITION[line]
  const nut: [string, string][] = n
    ? [
        ['조단백질', `${n.protein}% 이상`],
        ['조지방', `${n.fat}% 이하`],
        ['조섬유', `${n.fiber}% 이하`],
        ['조회분', `${n.ash}% 이하`],
        ['수분', `${n.moisture}% 이하`],
        ['칼슘', `${n.calcium}% 이상`],
        ['인', `${n.phosphorus}% 이상`],
      ]
    : []
  return (
    <div>
      {/* 제품 사진 자리 — 실사 누끼로 교체 예정(현재 placeholder). */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: 14,
          background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 20%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 56 }} aria-hidden>🍲</span>
      </div>

      {/* 이 레시피는요 — 고객용 설명(사장님 2026-07-13). */}
      {RECIPE_DESCRIPTIONS[line] && (
        <p style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.75, marginBottom: 16 }}>
          {RECIPE_DESCRIPTIONS[line]}
        </p>
      )}

      {/* 개인화 추천 이유 — 이 강아지 프로필 기반(추천 레시피만). */}
      {whyClean && (
        <div
          style={{
            marginBottom: 22,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--moss, #4f6a48) 8%, transparent)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--moss, #4f6a48)', marginBottom: 4 }}>
            {petName(dogName)}에게 추천한 이유
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>
            {whyClean}에 맞춰 {petName(dogName)}에게 추천했어요.
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>전체 재료</div>
      <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.75, marginBottom: 22 }}>
        {ings.join(', ')}
      </p>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 9 }}>
        등록성분 <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>· 보장분석</span>
      </div>
      <div style={{ border: '1px solid var(--rule)', borderRadius: 10, overflow: 'hidden' }}>
        {nut.map(([label, value], i) => (
          <div
            key={label}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 13px', borderTop: i > 0 ? '1px solid var(--rule)' : 'none', fontSize: 12.5 }}
          >
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 11, lineHeight: 1.5 }}>
        제조국가 한국 · AAFCO 2024 · FEDIAF · NRC 2006 기준 완전·균형식.
      </p>
    </div>
  )
}

/** 추천/선택 레시피 강조 카드 (위쪽). 사진 크게 + 재료 + ★추천. */
function HeroCard({
  line,
  isRec,
  why,
  removable,
  onRemove,
  onDetail,
}: {
  line: FoodLine
  isRec: boolean
  why: string
  removable: boolean
  onRemove: () => void
  onDetail: () => void
}) {
  const meta = FOOD_LINE_META[line]
  const ings = cardIngredients(line)
  // 추천 이유 = 그 아이의 근거(트리거) + 레시피 특성. 추천 카드에만 노출.
  const cleanTrigger = why.replace(/^케어 목표\s*=\s*/, '').trim()
  const recipeWhy = RECIPE_WHY[line] ?? ''
  const recReason =
    cleanTrigger && recipeWhy
      ? `${cleanTrigger} · ${recipeWhy}`
      : recipeWhy || cleanTrigger
  return (
    <div style={{ background: 'var(--surface-card-elevated, #fff)', border: '2px solid var(--terracotta)', borderRadius: 16, padding: 14, position: 'relative', overflow: 'hidden' }}>
      {isRec && (
        <span style={{ position: 'absolute', top: 0, right: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: 'var(--moss, #4f6a48)', padding: '4px 12px', borderBottomLeftRadius: 12 }}>★ 추천</span>
      )}
      <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
        <div style={heroCircle(`color-mix(in srgb, ${meta.color} 14%, transparent)`, meta.color)}>
          <span style={{ fontSize: 32 }} aria-hidden>🍲</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {RECIPE_TITLES[line] ?? meta.name}
          </div>
        </div>
      </div>
      {/* 추천 이유 — 알고리즘이 추천한(★) 레시피에만. 직접 담은(추가) 레시피엔
          안 띄우고 중립 태그로 구분(사장님 2026-07-14: 추가 담은 오리·소엔 추천
          이유가 뜨면 안 됨 → 맞춤 느낌 유지). */}
      {isRec ? (
        <div style={{ marginTop: 12, marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, lineHeight: 2 }}>
            <span
              style={{
                display: 'inline-block',
                position: 'relative',
                fontWeight: 900,
                color: 'var(--moss, #4f6a48)',
              }}
            >
              추천 이유
              <svg
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                aria-hidden
                style={{ position: 'absolute', left: 0, bottom: -2, width: '100%', height: 8, overflow: 'visible' }}
              >
                <path
                  d="M0,4.5 C18,2 32,6.5 52,4 C72,1.8 88,6 100,3.5"
                  stroke="var(--moss, #4f6a48)"
                  strokeWidth={2.4}
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span> · {recReason}</span>
          </span>
        </div>
      ) : (
        <div style={{ marginTop: 11, marginBottom: 2 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--muted)',
              background: 'var(--bg-2)',
              padding: '3px 9px',
              borderRadius: 99,
            }}
          >
            <Check size={11} strokeWidth={2.6} />
            직접 담은 레시피
          </span>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 9, lineHeight: 1.55 }}>
        {ings.join(', ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--rule)' }}>
        <button
          type="button"
          onClick={onDetail}
          style={{ appearance: 'none', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: 'var(--terracotta)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 1 }}
        >
          재료 전체 · 영양성분
          <ChevronRight size={13} strokeWidth={2.4} />
        </button>
        {removable ? (
          <button type="button" onClick={onRemove} style={{ appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--rule)', padding: '6px 13px', borderRadius: 99 }}>
            빼기
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--terracotta)', background: 'color-mix(in srgb, var(--terracotta) 9%, transparent)', padding: '6px 14px', borderRadius: 99 }}>
            <Check size={15} strokeWidth={2.4} />담김
          </span>
        )}
      </div>
    </div>
  )
}

function heroCircle(bg: string, ring: string): CSSProperties {
  return { width: 68, height: 68, borderRadius: '50%', background: bg, boxShadow: `0 0 0 1px color-mix(in srgb, ${ring} 22%, transparent), 0 0 0 5px color-mix(in srgb, ${ring} 5%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }
}
function miniCircle(bg: string): CSSProperties {
  return { width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }
}
function ctaLink(): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '10px 18px', background: 'var(--terracotta)', color: '#fff', borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: 'none' }
}
