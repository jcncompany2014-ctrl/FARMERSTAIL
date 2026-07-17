/**
 * 박스 분량·가격 산정 — **정본 (single source of truth).**
 *
 * # 왜 lib 으로 뺐나 (2026-07-17)
 *
 * 이 계산은 원래 `app/(main)/dogs/[id]/order/OrderClient.tsx` **안에** 있었다
 * (client 컴포넌트 내부 함수 + 인라인 루프). 그래서:
 *   · 서버에서 재사용이 불가능했고,
 *   · 처방이 바뀔 때 **가격을 다시 계산할 방법이 없었다** → 구독은 가입 시
 *     `total_amount` 로 영원히 고정된 채, 포장량(`daily_grams`)만 처방 따라
 *     변했다 = **개인화된 양을 보내며 고정 금액을 받는 상태**(마진 누수).
 *
 * 사장님 결정(2026-07-17): **처방 → 가격 연동(TFD 방식)**. 처방이 바뀌면 금액을
 * 다시 계산해 보호자에게 "68,000 → 74,000원" 을 보여주고 동의를 받는다.
 * 그러려면 **주문 화면과 승인 화면이 정확히 같은 계산**을 써야 한다 — 계산이
 * 둘이면 "주문서 금액 ≠ 승인 화면 금액" 으로 조용히 갈라지고, 그건 돈이라
 * 즉시 신뢰 사고다. 그래서 여기 하나만 둔다.
 *
 * ⚠️ **가격 계산을 여기 밖에서 다시 구현하지 말 것.** 화면이 필요하면 이 함수를
 * 부른다. (계수 사다리·RER 이 두 곳에 있어서 겪은 혼란과 같은 실수 반복 금지.)
 *
 * # 모델 (2026-07-13 확정 — 무조건 2주마다 배송·결제)
 *  · 사이클 = 14일치. 매 끼 화식 비율(freshRatio)만큼 섞어 급여 →
 *    하루 화식 분량 = 100% 분량 × freshRatio/100. 나머지는 보호자 사료.
 *  · 메인 5종 — 1팩 = 1일 화식 분량(10g 단위 ceil), 14일 = 14팩.
 *  · 토퍼 — 100g 동결건조 고정 팩, 사이클 총 필요량 ±5% tolerance.
 *  · 가격 — product.price 는 **100g 단위 단가**(예: 소 7,000원/100g).
 *    메인 1팩 = mealG/100 × 단가 (100원 단위 반올림) → 총액이 화식 비율에 비례
 *    (곁들임 30% ≈ 풀 화식의 30% 가격).
 *  · 배송비 0 (구독가에 번들 — 낱개 커머스 폐지 후).
 */
import { FOOD_LINE_META, ALL_LINES } from './lines.ts'
import {
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
  deriveAvailableLines,
  deriveAvailableToppers,
  gateAvailability,
} from './skuMap.ts'
import { snapBoxRatios } from './boxComposition.ts'
import type { Formula, FoodLine } from './types.ts'

/** 한 사이클 = 14일 (biweekly 배송·결제 고정). */
export const CYCLE_DAYS = 14

/** 토퍼 kcal/100g fallback — product.nutrition_facts 없을 때 (USDA 동결건조 평균). */
export const TOPPER_KCAL_PER_100G = 380

/** 사료관리법 표시기준 허용 오차 (95% 이상 발송이면 floor 허용). */
const TOLERANCE = 0.95

/** 가격 산정에 필요한 최소 product 모양. 화면 타입(OrderProduct 등)은 이걸 만족하면 됨. */
export type BoxProduct = {
  slug: string
  /** 정가 — 100g 단위 단가. */
  price: number
  /** 구독가(할인가). 있으면 실청구 기준. */
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
  nutrition_facts?: Record<string, unknown> | null
}

export type BoxItem<P extends BoxProduct = BoxProduct> = {
  slug: string
  line?: FoodLine
  topper?: 'vegetable' | 'protein'
  pct: number
  product: P
  /** 발송할 팩 개수. 메인 = CYCLE_DAYS, 토퍼 = ±5% tolerance. */
  quantity: number
  /** 한 팩 g — 메인은 일끼 분량, 토퍼는 100g 고정. */
  packG: number
  /** 일일 분량 g (계산값). */
  dailyG: number
  /** 한끼 분량 g. */
  mealG: number
  /** 사이클 총 필요 g. */
  cycleG: number
  /** 사이클 실제 발송 g. */
  deliveredG: number
  /** 1팩 단가 (구독가 기준 — 실청구). */
  pricePerPack: number
  /** 1팩 정가 — "정가→구독 할인" 시각화용. 표시 전용. */
  listPricePerPack: number
}

/**
 * 메인 라인 — 1팩 = 1일 한끼 분량.
 * 일일 g 을 10g 단위로 ceil (사료관리법 표시기준 ±5% 허용 내).
 * 예: 164g → 170g, 158g → 160g.
 */
export function mealPortionG(dailyG: number): number {
  if (dailyG <= 0) return 0
  return Math.ceil(dailyG / 10) * 10
}

/**
 * 토퍼 — 100g 동결건조 고정 팩. 사이클 총 필요량을 100g 팩 단위로
 * 사료관리법 ±5% 허용 내 floor/ceil 결정.
 */
export function topperPacksForCycle(cycleG: number): {
  packs: number
  deliveredG: number
} {
  if (cycleG <= 0) return { packs: 1, deliveredG: 100 }
  const packG = 100
  const exact = cycleG / packG
  const floor = Math.max(1, Math.floor(exact))
  const ceil = Math.max(1, Math.ceil(exact))
  if (floor === ceil) return { packs: floor, deliveredG: floor * packG }
  if (floor * packG >= cycleG * TOLERANCE) {
    return { packs: floor, deliveredG: floor * packG }
  }
  return { packs: ceil, deliveredG: ceil * packG }
}

/**
 * 100g 단위 단가 기반 1팩 가격 — 100원 단위 반올림.
 */
export function pricePerPack(unitPricePer100g: number, packG: number): number {
  return Math.round(((packG / 100) * unitPricePer100g) / 100) * 100
}

/**
 * 처방 + 화식 비율 + 제품 → 배송 항목 목록.
 *
 * 가용성 게이트(활성 제품 없는 라인 재분배) + 박스 2종 스냅까지 여기서 처리하므로,
 * 저장된 formula 가 게이트 이전 버전이어도 박스는 항상 100% 충족한다.
 */
export function computeBoxItems<P extends BoxProduct>(input: {
  formula: Pick<Formula, 'lineRatios' | 'toppers' | 'dailyKcal'>
  /** 화식 비율 티어 — 30(곁들임) / 60(반반) / 100(완전). */
  freshRatio: number
  /** slug → product. */
  products: Record<string, P>
  cycleDays?: number
}): Array<BoxItem<P>> {
  const { formula, freshRatio, products } = input
  const cycleDays = input.cycleDays ?? CYCLE_DAYS
  const freshFactor = freshRatio / 100
  const items: Array<BoxItem<P>> = []
  const dailyKcal = formula.dailyKcal

  const gated = gateAvailability(formula.lineRatios, formula.toppers, {
    availableLines: deriveAvailableLines(Object.keys(products)),
    availableToppers: deriveAvailableToppers(Object.keys(products)),
  })
  // 박스는 SKU 최대 2종 (1종 100% / 2종 50:50) — 사장님 2026-07-13.
  // 토퍼는 별개 add-on 이라 스냅 대상 아님.
  const boxRatios = snapBoxRatios(gated.lineRatios)

  for (const line of ALL_LINES) {
    const ratio = boxRatios[line] ?? 0
    if (ratio <= 0) continue
    const slug = LINE_TO_SLUG[line]
    if (!slug) continue
    const product = products[slug]
    if (!product) continue

    const kcalPer100g = FOOD_LINE_META[line].kcalPer100g
    // 매끼섞기 — 하루 화식 분량 = 100% 분량 × 화식 비율.
    const dailyG = ((ratio * dailyKcal) / kcalPer100g) * 100 * freshFactor
    const mealG = mealPortionG(dailyG)
    const unitPrice = product.sale_price ?? product.price
    items.push({
      slug,
      line,
      pct: Math.round(ratio * 100),
      product,
      quantity: cycleDays, // 1일 1팩
      packG: mealG,
      mealG,
      dailyG,
      cycleG: dailyG * cycleDays,
      deliveredG: mealG * cycleDays,
      pricePerPack: pricePerPack(unitPrice, mealG),
      listPricePerPack: pricePerPack(product.price, mealG),
    })
  }

  for (const k of ['vegetable', 'protein'] as const) {
    const ratio = gated.toppers[k] ?? 0
    if (ratio <= 0) continue
    const slug = TOPPER_TO_SLUG[k]
    const product = products[slug]
    if (!product) continue
    // admin 입력 kcal 우선, 없으면 fallback.
    const topperKcal100g =
      (product.nutrition_facts?.calories_kcal_per_100g as number | undefined) ??
      TOPPER_KCAL_PER_100G
    const dailyG = ((ratio * dailyKcal) / topperKcal100g) * 100 * freshFactor
    const cycleG = dailyG * cycleDays
    const { packs, deliveredG } = topperPacksForCycle(cycleG)
    const unitPrice = product.sale_price ?? product.price
    items.push({
      slug,
      topper: k,
      pct: Math.round(ratio * 100),
      product,
      quantity: packs,
      packG: 100,
      mealG: dailyG, // 토퍼는 일일 sprinkle 분량
      dailyG,
      cycleG,
      deliveredG,
      // 토퍼는 100g 표준 팩 → 단가 그대로
      pricePerPack: unitPrice,
      listPricePerPack: product.price,
    })
  }

  return items
}

/**
 * 실제 청구 대상 항목만 — 품절·구독불가 제외.
 * (주문 화면이 구독 생성 시 쓰는 필터와 **같아야** 금액이 안 갈라진다.)
 */
export function subscribableItems<P extends BoxProduct>(
  items: Array<BoxItem<P>>,
): Array<BoxItem<P>> {
  return items.filter(
    (it) => (it.product.stock ?? 0) > 0 && it.product.is_subscribable !== false,
  )
}

export type BoxPrice = {
  /** 청구 대상 항목 합. */
  subtotal: number
  /** 배송비 — 구독가에 번들되어 0. */
  shipping: number
  /** 실청구액 = subscriptions.total_amount 에 들어가는 값. */
  total: number
}

/**
 * 항목 → 금액. `subscriptions.total_amount` 의 정본 계산.
 */
export function priceBox<P extends BoxProduct>(
  items: Array<BoxItem<P>>,
): BoxPrice {
  const subtotal = subscribableItems(items).reduce(
    (s, it) => s + it.pricePerPack * it.quantity,
    0,
  )
  const shipping = 0
  return { subtotal, shipping, total: subtotal + shipping }
}

/**
 * 처방 → 금액 한 번에. 승인 흐름(서버)이 쓰는 진입점.
 */
export function priceForFormula<P extends BoxProduct>(input: {
  formula: Pick<Formula, 'lineRatios' | 'toppers' | 'dailyKcal'>
  freshRatio: number
  products: Record<string, P>
  cycleDays?: number
}): BoxPrice {
  return priceBox(computeBoxItems(input))
}
