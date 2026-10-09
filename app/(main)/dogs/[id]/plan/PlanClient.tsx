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
 * # Phase 진행 (2026-07-19 가격 정합까지 완료)
 *  실제 재료(사장님 배합표)·선택 handoff(?recipes=)·가격 정합(boxPricing 정본
 *  공유 — 결제 바 금액 = /order 실청구액)·결과지 슬림화까지 반영.
 *  남은 것: 실사 누끼 사진(사장님 자산 대기).
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 캔버스 S29·S30)
 * 모양만 시안대로 — 추천·잠금·담기/빼기 규칙, 가격 계산(boxPricing 정본 = /order 실청구), 넘기는 주소(?fresh=&recipes=)는
 * 그대로다. 함께 들어간 결정(앱시안_결정할것.md 3번): 영어 레시피 이름("CHICKEN · 무항생제 닭") → "닭고기 · 무항생제 닭",
 * "AAFCO·FEDIAF 충족" → "국제 영양 기준 충족", 화식 비율 %(티어 부제) 빼기, 레시피 상세 끝줄의 기관 이름 → "국제 반려견 영양 기준".
 * 레시피 카드 사진은 레시피 팩 스튜디오 컷(겉봉투 사진 아님), 이름 앞 네모는 파우치 색(lib/design/pouch 와 같은 색).
 */

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Plus, Lock, AlertTriangle, ChevronRight } from 'lucide-react'
import { petName } from '@/lib/korean'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { SheetContent } from '@/components/v3/sheet/SheetParts'
import FunnelSteps from '@/components/v3/funnel/FunnelSteps'
import DogPawMark from '@/components/DogPawMark'
import { FOOD_LINE_META } from '@/lib/personalization/lines'
import { studioPouchImageForLine, bowlImageForLine } from '@/lib/personalization/packageImage'
import { cardIngredientNames, fullIngredientNames } from '@/lib/recipe-ingredients'
import {
  computeBoxItems,
  priceBox,
  subscribableItems,
  CYCLE_DAYS,
} from '@/lib/personalization/boxPricing'
import { ratiosFromPicks } from '@/lib/personalization/boxPicks'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'
import { snapBoxLines } from '@/lib/personalization/boxComposition'
import { fetchComputedFormula, isPermanentComputeFailure } from '@/lib/personalization/formulaCache'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { FRESH_TIERS, type FreshRatio } from '@/lib/subscription/freshTier'
import { V3 } from '@/lib/design/tokens'
import { RECIPE_COLOR } from '@/components/analysis/display'
import { FOOD_LINE_POUCH } from '@/lib/design/pouch'

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
// ★2026-08-25 — 여기 있던 하드코딩 목록을 lib/recipe-ingredients 정본으로 옮겼다.
//   원재료 표시는 사료관리법 표시사항이라 마스터·붙임2·DB 와 같아야 한다.
//   (2026-09-26 주석 정정: 예전 이 자리엔 "강황은 닭 전용·브로콜리 등은 없는 토핑"이라 적혀
//   있었는데, 그건 8/25 오전의 잘못된 판단이고 같은 날 사장님 확정 배합표 v4.0 LAST 로 뒤집혔다 —
//   강황 0.10% 4종 공통, 컨셉 토핑 hero+support 2종 실재. 정본 파일 머리말 참조.)
const cardIngredients = cardIngredientNames
const fullIngredients = fullIngredientNames

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
    '고단백에 헴철분이 풍부해 활동량 많은 아이, 근육과 활력이 필요한 아이에게 좋아요. 진한 풍미라 입이 짧은 아이도 잘 먹어요. 프리미엄 한우 목심을 담습니다.',
  basic:
    '닭·소가 잘 안 맞는 아이도 편하게 먹는 노블 단백질이에요. 흔한 알레르겐이 아니라 부담이 낮으면서도, 담백한 감칠맛이 있어 기호성이 좋아요. 무항생제 오리 안심을 씁니다.',
  joint:
    '예민한 아이에게 부드러운 저알러지 단백질이에요. 소화가 편하고, 제주산 흑돼지 특유의 고소한 풍미로 잘 먹어요. 지방이 적은 뒷다리살 부위를 메인으로 담습니다.',
}

// 레시피 이름 (사장님 지정 2026-07-13 — 앞의 영어 'CHICKEN ·' 는 2026-10-09 결정으로 뺐다: 부모님 세대가 못 읽는 글자).
// line→단백질: weight=닭·premium=소·basic=오리·joint=돼지.
const RECIPE_NAMES: Record<string, { name: string; sub: string }> = {
  weight: { name: '닭고기', sub: '무항생제 닭' },
  premium: { name: '한우', sub: '프리미엄 한우' },
  basic: { name: '오리', sub: '무항생제 오리' },
  joint: { name: '흑돼지', sub: '제주산 흑돼지' },
}

/** 라인 → 파우치 색(이름 앞 네모) — lib/design/pouch 정본. 홈·정기배송 화면의 박스 색과 같다. */
const LINE_POUCH = FOOD_LINE_POUCH

// 레시피(단백질) 특성 → 편익 한 줄. 추천 카드의 "추천 이유"에 그 아이의 근거
// (트리거)와 결합해 노출 — "체중 관리 · 저지방 닭가슴살이라…" 식(사장님 2026-07-14).
const RECIPE_WHY: Record<string, string> = {
  weight: '단백질이 진한 닭가슴살이라 근육 지키며 체중 관리에 좋아요',
  premium: '고단백·헴철분이 풍부해 활력과 근육에 좋아요',
  basic: '흔한 알레르겐이 아니라 예민한 속에도 부담이 적어요',
  joint: '저지방 흑돼지 뒷다리살이라 부드럽고 소화가 편해요',
}

// 플랜 = 실제로 고르는 상품 페이지라 '자세하게'(배지·설명·안내). 분석 결과지는
// 반대로 컴팩트 — 역할 분담(사장님 2026-07-14). 카피는 결과지와 동일 문구.
// 티어 정의는 정본 lib/subscription/freshTier (FRESH_TIERS). 3화면 공유.

const MAX_RECIPES = 2

/** 고르지 않은 칸 테두리 — 시안의 옅은 회색. */
const IDLE_BORDER = '#D5D3D4'

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
  dogPhoto = null,
  products,
  initialFresh,
}: {
  dogId: string
  dogName: string
  /** 머리줄 작은 사진(시안 S29). 없으면 발바닥 자리. */
  dogPhoto?: string | null
  products: Record<string, PlanProduct>
  initialFresh: number
}) {
  const [state, setState] = useState<
    | { s: 'loading' }
    | { s: 'ready'; formula: Formula }
    | { s: 'empty' }
    | { s: 'retry' }
  >({ s: 'loading' })
  // '다시 시도' — 일시 실패만. 값이 바뀌면 아래 effect 가 다시 부른다(캐시는 일시 실패를 안 담는다).
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { httpOk, body } = await fetchComputedFormula(dogId, 1)
        if (cancelled) return
        if (!httpOk || !('ok' in body) || body.ok !== true) {
          // 설문·분석이 먼저 필요한 경우만 '결과 없음'. 429·5xx·401 은 일시 실패(2026-09-26).
          setState(isPermanentComputeFailure(body) ? { s: 'empty' } : { s: 'retry' })
          return
        }
        // 안전 게이트 — 판매 레시피 전부 알레르기면 플랜(오리 표시) 대신
        // 분석 페이지 상담 안내로 보낸다(2026-07-24). 결제 경로 일원 차단.
        if (body.needsConsultation) {
          window.location.replace(`/dogs/${dogId}/analysis`)
          return
        }
        setState({ s: 'ready', formula: body.formula })
      } catch {
        if (!cancelled) setState({ s: 'retry' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, attempt])

  if (state.s === 'loading') {
    return (
      <div style={{ padding: '18px 20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-40 mt-3" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-36 w-full mt-3" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (state.s === 'retry') {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: V3.ink }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>레시피를 불러오지 못했어요</p>
        <p style={{ fontSize: 16, color: V3.inkSoft, margin: '8px 0 20px' }}>
          잠시 연결이 매끄럽지 않아요. 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ s: 'loading' })
            setAttempt((n) => n + 1)
          }}
          style={{ ...ctaLink(), border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (state.s === 'empty') {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: V3.ink }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>아직 맞춤 결과가 없어요</p>
        <p style={{ fontSize: 16, color: V3.inkSoft, margin: '8px 0 20px', wordBreak: 'keep-all' }}>
          분석을 먼저 받으면 {petName(dogName)}에게 맞는 레시피를 추천해 드려요.
        </p>
        <Link href={`/dogs/${dogId}/analysis`} style={ctaLink()}>
          분석 보러가기 <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>
    )
  }

  return (
    <PlanView
      dogId={dogId}
      dogName={dogName}
      dogPhoto={dogPhoto}
      formula={state.formula}
      products={products}
      initialFresh={initialFresh}
    />
  )
}

/** 플랜 본체 — formula 확정 후 렌더. 선택 상태는 이 시점 추천으로 초기화된다. 점검 화면(/design-check)도 이걸 그린다. */
export function PlanView({
  dogId,
  dogName,
  dogPhoto = null,
  formula,
  products,
  initialFresh,
}: {
  dogId: string
  dogName: string
  dogPhoto?: string | null
  formula: Formula
  products: Record<string, PlanProduct>
  initialFresh: number
}) {
  const [freshRatio, setFreshRatio] = useState<FreshRatio>(
    initialFresh === 50 ? 50 : initialFresh === 100 ? 100 : 30,
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

  // 대표 가격 — /order 실청구와 **같은 정본**(boxPricing.computeBoxItems)으로 계산.
  // 이전엔 여기서 간이 곱셈(10g 올림 없음·100원 반올림 없음·토퍼 누락)으로 자체
  // 계산해, 토퍼 있는 처방이면 결제 바 금액이 주문서보다 몇천 원 낮게 보였다
  // (가격 정합 Phase③). 선택 레시피(1종 100%/2종 50:50)는 /order 가 ?recipes=
  // 를 소비할 때 쓰는 ratiosFromPicks 와 같은 함수로 비율화 — 화면과 청구가 못
  // 갈라진다. 표시는 기본 구독가만 — 나무 등급 +10%·이벤트(신규가입) 할인은
  // 계정 조건이라 결제 시 자동 적용(2026-07-17 블랭킷 첫주문 50% 폐지).
  const boxItems = formula
    ? computeBoxItems({
        formula: {
          lineRatios: ratiosFromPicks([...selected]),
          toppers: formula.toppers,
          dailyKcal: formula.dailyKcal,
        },
        freshRatio,
        products,
      })
    : []
  // 앵커(정가 취소선)도 청구 대상 필터(priceBox 와 동일)를 태워야 할인 폭이
  // 실제와 일치한다. 합산은 listCycleTotal — 팩당 표시가 합산 금지(올림 증폭).
  const billable = subscribableItems(boxItems)
  const cyclePay = priceBox(boxItems).total
  const cycleAnchor = billable.reduce((s, it) => s + it.listCycleTotal, 0)
  // 하루 단가 = 사이클 총액 ÷ 14 (10원 올림 — 가격은 절대 내림 없음, 실제보다
  // 낮아 보이는 방향의 오차 금지. 사장님 2026-07-19).
  const dailyPay = Math.ceil(cyclePay / CYCLE_DAYS / 10) * 10
  const offLabel = `구독 ${SUBSCRIPTION_DISCOUNT_PCT}%`

  const others = RECIPE_LINES.filter((l) => !selected.has(l))
  const canAddMore = selected.size < MAX_RECIPES
  const name = petName(dogName)

  return (
    <div style={{ position: 'relative', paddingBottom: 12, color: V3.ink }}>
      <FunnelSteps current={1} />

      <section style={{ padding: '22px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
          <span
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              overflow: 'hidden',
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {dogPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- 26px 원형 머리 사진
              <img src={dogPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} decoding="async" />
            ) : (
              <DogPawMark size={14} color={V3.inkMute} />
            )}
          </span>
          {name}를 위한 맞춤 식단
        </span>
        {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
        <h1 style={{ margin: '10px 0 0', fontSize: 34, lineHeight: 1.15 }}>
          이 레시피를
          <br />
          추천해요
        </h1>
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['수의영양학', '국제 영양 기준 충족', '사람도 먹는 등급'].map((t) => (
            <span
              key={t}
              style={{
                height: 28,
                padding: '0 9px',
                borderRadius: 4,
                background: V3.soft,
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── 위: 내 플랜 (추천 강조) ─────────────────────────────── */}
      <section aria-labelledby="my-plan" style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="my-plan" style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{name}의 플랜</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute, fontFamily: 'var(--font-sans)' }}>
            {selected.size}가지 · 최대 {MAX_RECIPES}
          </span>
        </h2>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      </section>

      {/* ── 아래: 다른 레시피로 바꾸기 ───────────────────────────── */}
      {others.length > 0 && (
        <section aria-labelledby="other-recipes" style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h3 id="other-recipes" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            다른 레시피로 바꾸기
          </h3>
          <div style={{ marginTop: 10, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {others.map((line) => {
              const meta = FOOD_LINE_META[line]
              const isBlocked = blocked.has(line)
              const isRec = recommended.has(line)
              const rn = RECIPE_NAMES[line]
              const pouch = studioPouchImageForLine(line)
              return (
                <div
                  key={line}
                  style={{
                    minHeight: 72,
                    padding: '10px 0',
                    boxSizing: 'border-box',
                    borderBottom: `1px solid ${V3.rule}`,
                    display: 'grid',
                    gridTemplateColumns: '48px minmax(0, 1fr) auto',
                    columnGap: 12,
                    alignItems: 'center',
                    opacity: isBlocked ? 0.75 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: V3.soft,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isBlocked ? (
                      <Lock size={18} strokeWidth={2} color={V3.inkMute} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- 고정 크기 썸네일(레시피 팩 스튜디오 컷)
                      <img
                        src={pouch ?? bowlImageForLine(line)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        decoding="async"
                      />
                    )}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 17, fontWeight: 800, color: isBlocked ? V3.inkMute : V3.ink }}>
                      <span aria-hidden style={{ width: 9, height: 9, background: RECIPE_COLOR[LINE_POUCH[line] ?? 'chicken'], flexShrink: 0 }} />
                      {rn?.name ?? meta.nameKo}
                      <span style={{ fontSize: 14, fontWeight: 600, color: V3.inkMute }}>{rn?.sub}</span>
                      {isRec && !isBlocked && (
                        <span style={{ fontSize: 13, fontWeight: 800, color: V3.ink }}>★ 추천</span>
                      )}
                    </span>
                    {isBlocked ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, color: V3.sale, fontWeight: 700 }}>
                        <AlertTriangle size={13} strokeWidth={2.2} aria-hidden />
                        알레르기로 제외
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, color: V3.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cardIngredients(line).slice(0, 4).join(', ')}…
                      </span>
                    )}
                  </span>
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
                        height: 40,
                        padding: '0 12px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 15,
                        fontWeight: 700,
                        color: canAddMore ? V3.ink : V3.inkFaint,
                        background: '#FFFFFF',
                        border: `1.5px solid ${canAddMore ? V3.ink : V3.rule}`,
                      }}
                    >
                      <Plus size={14} strokeWidth={2.4} aria-hidden />
                      {canAddMore ? '담기' : '가득'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {!canAddMore && (
            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 14, color: V3.inkMute }}>
              최대 {MAX_RECIPES}가지예요 · 바꾸려면 위에서 하나 빼주세요
            </p>
          )}
        </section>
      )}

      {/* 화식 비율 — 비율(%)은 말하지 않는다(앱시안 결정 3번). 이름·설명만. */}
      <section
        aria-labelledby="fresh-q"
        style={{ margin: '26px 20px 0', paddingTop: 18, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}
      >
        <h2 id="fresh-q" style={{ margin: 0, fontSize: 24 }}>
          얼마나 화식으로 드릴까요?
        </h2>
        <div role="radiogroup" aria-labelledby="fresh-q" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FRESH_TIERS.map((t) => {
            const on = freshRatio === t.ratio
            return (
              <button
                key={t.ratio}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFreshRatio(t.ratio)}
                className="ft-no-press"
                style={{
                  appearance: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 14,
                  borderRadius: 4,
                  border: on ? `2px solid ${V3.ink}` : `1.5px solid ${IDLE_BORDER}`,
                  background: on ? V3.soft : '#FFFFFF',
                  color: V3.ink,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: on ? `6px solid ${V3.ink}` : `1.5px solid ${V3.inkFaint}`,
                      background: '#FFFFFF',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{t.label}</span>
                  {'badge' in t && t.badge && (
                    <span
                      style={{
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 4,
                        background: V3.ink,
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {t.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: on ? V3.inkSoft : V3.inkMute, wordBreak: 'keep-all' }}>{t.copy}</span>
                {'note' in t && t.note && (
                  <span
                    style={{
                      paddingTop: 8,
                      borderTop: '1px solid #DEDCDD',
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: V3.inkMute,
                      wordBreak: 'keep-all',
                    }}
                  >
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
          <p
            style={{
              margin: '14px 0 0',
              paddingTop: 12,
              borderTop: `1px solid ${V3.rule}`,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 6,
              fontSize: 15,
              color: V3.inkMute,
            }}
          >
            하루
            <strong style={{ fontSize: 18, fontWeight: 900, color: V3.ink }}>{dailyPay.toLocaleString('ko-KR')}원</strong>
            <span>· 정기배송가 기준</span>
          </p>
        )}
      </section>

      {/* 결제 바 (먹색) — 총가격(2주). 상세 시트 열리면 숨김(시트 밑으로
          비쳐 보이는 문제 방지). 바 높이는 AppChrome 의 --ft-paybar-h 가 본문 아래 여백으로 비워 둔다(규칙88). */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: V3.ink,
          color: '#FFFFFF',
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom))',
          display: detailLine ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>2주마다 배송 · 다음 결제 전 해지</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
            {cycleAnchor > cyclePay && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through' }}>
                {cycleAnchor.toLocaleString('ko-KR')}원
              </span>
            )}
            <span>
              <span className="ft-num" style={{ fontSize: 26 }}>
                {cyclePay.toLocaleString('ko-KR')}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>원</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>/2주</span>
            </span>
            {cycleAnchor > cyclePay && (
              <span
                style={{
                  height: 22,
                  padding: '0 6px',
                  borderRadius: 4,
                  background: '#FFFFFF',
                  color: V3.ink,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}
              >
                {offLabel}
              </span>
            )}
          </span>
        </span>
        <Link
          href={`/dogs/${dogId}/order?fresh=${freshRatio}&recipes=${[...selected].join(',')}`}
          style={{
            flexShrink: 0,
            height: 52,
            padding: '0 14px',
            borderRadius: 4,
            background: '#FFFFFF',
            color: V3.ink,
            fontSize: 16,
            fontWeight: 800,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}
        >
          플랜 담기 <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
        </Link>
      </div>

      {/* 재료 전체·영양성분 — 밑에서 올라오는 바텀시트. 머리줄은 시안(S30)대로 시트 안에서 그린다. */}
      <BottomSheet
        open={detailLine !== null}
        onClose={() => setDetailLine(null)}
        ariaLabel={detailLine ? `${RECIPE_NAMES[detailLine]?.name ?? ''} 재료 전체 · 영양성분` : '레시피 상세'}
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
              onClose={() => setDetailLine(null)}
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
  onClose,
}: {
  line: FoodLine
  dogName: string
  why: string
  onClose: () => void
}) {
  const meta = FOOD_LINE_META[line]
  const rn = RECIPE_NAMES[line]
  const pouchSrc = studioPouchImageForLine(line)
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
    <SheetContent>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: V3.ink }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span aria-hidden style={{ width: 12, height: 12, background: RECIPE_COLOR[LINE_POUCH[line] ?? 'chicken'], flexShrink: 0 }} />
          <span style={{ fontSize: 26 }}>{rn?.name ?? meta.nameKo}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: V3.inkMute, fontFamily: 'var(--font-sans)' }}>{rn?.sub}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            flexShrink: 0,
            width: 48,
            height: 48,
            marginRight: -10,
            border: 0,
            background: 'transparent',
            color: V3.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* 제품 사진 — 레시피 팩 스튜디오 컷(시안 S30: 모서리 4 사진 칸). 예전엔 시트 배경에 multiply 로 녹였는데
          (2026-10-02, 그때 시트 바탕은 크림색) 흰 시트에선 칸 그대로가 시안이다. lazy 금지 — 안드로이드
          WebView 에서 안 뜬다(실측). 사진 없는 라인(연어)은 그릇 사진으로 대신한다. */}
      <div
        style={{
          marginTop: 10,
          width: '100%',
          aspectRatio: '7 / 5',
          borderRadius: 4,
          overflow: 'hidden',
          background: V3.soft,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 시트 안 고정 비율 슬롯 */}
        <img
          src={pouchSrc ?? bowlImageForLine(line)}
          alt={`${meta.nameKo} 화식 패키지`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 52%', display: 'block' }}
          decoding="async"
        />
      </div>

      {/* 완성 그릇 + 연출샷 고지 (사장님 2026-08-25).
          화식 사진은 실제 원물로 만든 **연출샷**이라, 실물과 다르게 보일 수
          있다는 걸 사진 바로 옆에서 밝힌다 — 표시광고 오인 방지이자 "왜 갈려
          있나"를 미리 답해 주는 자리다. 원형 썸네일이라 카드·주문 화면의 그
          사진과 같은 것임을 알아본다. */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '60px 1fr', columnGap: 12, alignItems: 'center' }}>
        <span style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 고정 크기 원형 썸네일 */}
          <img
            src={bowlImageForLine(line)}
            alt={`${meta.nameKo} 화식 완성 그릇`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            decoding="async"
          />
        </span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: V3.inkMute, wordBreak: 'keep-all' }}>
          사진은 실제 들어가는 원물로 연출한 컷이에요. 실제 제품은 같은 원물을 소화가 편하도록 곱게 갈아서 담아 드려요.
        </p>
      </div>

      {/* 이 레시피는요 — 고객용 설명(사장님 2026-07-13). */}
      {RECIPE_DESCRIPTIONS[line] && (
        <p style={{ margin: '18px 0 0', fontSize: 17, lineHeight: 1.7, color: V3.ink, wordBreak: 'keep-all' }}>
          {RECIPE_DESCRIPTIONS[line]}
        </p>
      )}

      {/* 개인화 추천 이유 — 이 강아지 프로필 기반(추천 레시피만). */}
      {whyClean && (
        <p style={{ margin: '14px 0 0', padding: '12px 14px', borderRadius: 4, background: V3.soft, fontSize: 16, lineHeight: 1.6, color: V3.ink, wordBreak: 'keep-all' }}>
          <strong style={{ fontWeight: 800 }}>{petName(dogName)}에게 추천한 이유</strong> · {whyClean}에 맞춰 {petName(dogName)}에게 추천했어요.
        </p>
      )}

      <h3 style={{ margin: '24px 0 0', paddingTop: 14, borderTop: `2px solid ${V3.ink}`, fontSize: 18, fontWeight: 800, color: V3.ink }}>
        전체 재료
      </h3>
      <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.7, color: V3.inkSoft, wordBreak: 'keep-all' }}>{ings.join(', ')}</p>

      <h3
        style={{
          margin: '24px 0 0',
          paddingTop: 14,
          borderTop: `2px solid ${V3.ink}`,
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          fontSize: 18,
          fontWeight: 800,
          color: V3.ink,
        }}
      >
        등록성분 <span style={{ fontSize: 14, fontWeight: 600, color: V3.inkMute }}>보장분석</span>
      </h3>
      {/* 등록성분 표의 % 는 법정 표시사항이라 그대로 둔다(앱시안 결정 14번). */}
      <dl style={{ margin: '10px 0 0', border: `1.5px solid ${IDLE_BORDER}`, borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
        {nut.map(([label, value], i) => (
          <div
            key={label}
            style={{
              minHeight: 46,
              padding: '0 14px',
              borderTop: i > 0 ? `1px solid ${V3.rule}` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 16,
            }}
          >
            <dt style={{ color: V3.inkMute }}>{label}</dt>
            <dd style={{ margin: 0, fontWeight: 800, color: V3.ink }}>{value}</dd>
          </div>
        ))}
      </dl>
      <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
        제조국가 한국 · 국제 반려견 영양 기준에 맞춘 완전·균형식.
      </p>
    </SheetContent>
  )
}

/** 추천/선택 레시피 강조 카드 (위쪽). 레시피 팩 사진 + 이름 + 추천 이유 + 재료(시안 S29). */
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
  const rn = RECIPE_NAMES[line]
  const ings = cardIngredients(line)
  const pouch = studioPouchImageForLine(line)
  // 추천 이유 = 그 아이의 근거(트리거) + 레시피 특성. 추천 카드에만 노출.
  const cleanTrigger = why.replace(/^케어 목표\s*=\s*/, '').trim()
  const recipeWhy = RECIPE_WHY[line] ?? ''
  const recReason =
    cleanTrigger && recipeWhy
      ? `${cleanTrigger} · ${recipeWhy}`
      : recipeWhy || cleanTrigger
  return (
    <article
      style={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: V3.soft,
        borderLeft: `6px solid ${V3.mustard}`,
        color: V3.ink,
      }}
    >
      {isRec && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: 28,
            padding: '0 10px',
            background: V3.ink,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ★ 추천
        </span>
      )}
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '76px 1fr', columnGap: 14, alignItems: 'center' }}>
        <span style={{ width: 76, height: 76, borderRadius: 4, overflow: 'hidden', background: '#FFFFFF', display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 고정 크기 슬롯(레시피 팩 스튜디오 컷) */}
          <img
            src={pouch ?? bowlImageForLine(line)}
            alt={`${rn?.name ?? meta.nameKo} 레시피 팩`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            decoding="async"
          />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 12, height: 12, background: RECIPE_COLOR[LINE_POUCH[line] ?? 'chicken'], flexShrink: 0 }} />
            <span className="ft-poster" style={{ fontSize: 26, lineHeight: 1 }}>
              {rn?.name ?? meta.nameKo}
            </span>
          </span>
          <span style={{ fontSize: 15, color: V3.inkSoft }}>{rn?.sub}</span>
        </span>
      </div>
      {/* 추천 이유 — 알고리즘이 추천한(★) 레시피에만. 직접 담은(추가) 레시피엔
          안 띄우고 중립 태그로 구분(사장님 2026-07-14: 추가 담은 오리·소엔 추천
          이유가 뜨면 안 됨 → 맞춤 느낌 유지). */}
      {isRec ? (
        <p style={{ margin: '0 14px', padding: '10px 12px', borderRadius: 4, background: '#FFFFFF', fontSize: 15, lineHeight: 1.55, wordBreak: 'keep-all' }}>
          <strong style={{ fontWeight: 800 }}>추천 이유</strong> · {recReason}
        </p>
      ) : (
        <span
          style={{
            margin: '0 14px',
            alignSelf: 'flex-start',
            height: 28,
            padding: '0 9px',
            borderRadius: 4,
            background: '#FFFFFF',
            fontSize: 14,
            fontWeight: 700,
            color: V3.inkSoft,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Check size={14} strokeWidth={2.6} aria-hidden />
          직접 담은 레시피
        </span>
      )}
      <p style={{ margin: '10px 14px 0', fontSize: 15, lineHeight: 1.5, color: V3.inkMute, wordBreak: 'keep-all' }}>
        {/* 카드는 발췌(메인+내장+토핑)라 '등'을 붙여 전체가 아님을 밝힌다
            (사장님 2026-08-25). 전체 목록은 '재료 전체' 시트에 있다. */}
        {ings.join(', ')} 등
      </p>
      <div
        style={{
          marginTop: 12,
          padding: '0 14px',
          minHeight: 56,
          borderTop: `1px solid ${V3.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={onDetail}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            padding: 0,
            minHeight: 48,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 800,
            color: V3.ink,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          재료 전체 · 영양성분
          <ChevronRight size={15} strokeWidth={2.4} aria-hidden />
        </button>
        {removable ? (
          <button
            type="button"
            onClick={onRemove}
            style={{
              appearance: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              height: 40,
              padding: '0 14px',
              borderRadius: 4,
              border: `1.5px solid ${IDLE_BORDER}`,
              background: '#FFFFFF',
              color: V3.inkSoft,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            빼기
          </button>
        ) : (
          <span
            style={{
              height: 40,
              padding: '0 12px',
              borderRadius: 4,
              background: '#FFFFFF',
              color: V3.ink,
              fontSize: 15,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Check size={16} strokeWidth={2.6} aria-hidden />
            담김
          </span>
        )}
      </div>
    </article>
  )
}

function ctaLink(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 52,
    padding: '0 20px',
    background: V3.ink,
    color: '#FFFFFF',
    borderRadius: 4,
    fontSize: 17,
    fontWeight: 800,
    textDecoration: 'none',
  }
}
