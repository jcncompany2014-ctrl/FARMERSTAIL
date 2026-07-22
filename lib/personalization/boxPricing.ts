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
 *  · 메인 5종 — 1팩 = 1일 화식 분량(5g 단위 **무조건 올림**), 14일 = 14팩.
 *  · 토퍼 — 100g 동결건조 고정 팩, 팩 수 **무조건 올림**(폐지 상태 — 호환 경로).
 *  · 가격 — product.price 는 **100g 단위 단가**(예: 소 8,300원/100g).
 *    ①청구(최종가): 라인 총액 = mealG/100 × 단가 × 14 를 **100원 단위 올림,
 *      총액 레벨에서 한 번만**(팩당 올림 ×14 증폭 금지). 총액이 화식 비율에
 *      비례(곁들임 30% ≈ 풀 화식의 30% 가격).
 *    ②팩당 표시가: 최종가 ÷ 팩수, 1원 단위면 **10원 올림** — 팩당×팩수 ≥
 *      최종가라 고객 검산에서 올림이 드러나지 않는다.
 *  · ★반올림·내림 금지 — 그램·가격 모두 올림만(사장님 2026-07-19). 고객이
 *    처방량보다 덜 받거나, 원가보다 낮게 청구되는 방향의 오차를 없앤다.
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
import { DELIVERY_INTERVAL_DAYS } from './cycle.ts'
import type { Formula, FoodLine } from './types.ts'

/**
 * 한 박스가 담는 급여 일수 = 배송 간격(14일). 정본은 cycle.ts —
 * "박스 = 한 배송 주기치" 라 값이 같아야 한다(따로 박아두면 갈라진다).
 */
export const CYCLE_DAYS = DELIVERY_INTERVAL_DAYS

/** 토퍼 kcal/100g fallback — product.nutrition_facts 없을 때 (USDA 동결건조 평균). */
export const TOPPER_KCAL_PER_100G = 380

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
  /** 라인 사이클 총액(구독가) — **실청구 정본**. 100원 올림은 여기서 한 번만. */
  cycleTotal: number
  /** 라인 사이클 총액(정가) — "정가→구독 할인" 앵커. 표시 전용. */
  listCycleTotal: number
  /** 1팩 **표시** 단가 = cycleTotal ÷ 팩수 (10원 올림). 청구 계산에 쓰지 말 것. */
  pricePerPack: number
  /** 1팩 표시 정가 = listCycleTotal ÷ 팩수 (10원 올림). 표시 전용. */
  listPricePerPack: number
}

/**
 * 메인 라인 — 1팩 = 1일 한끼 분량.
 * 일일 g 을 5g 단위로 **무조건 올림** (사장님 2026-07-19: 절대 내림 없음 —
 * 고객이 처방량보다 덜 받는 일이 없어야 한다. 표시량 이상 발송이라 사료관리법
 * 표시기준도 자동 충족).
 * 예: 164g → 165g, 161g → 165g, 165g → 165g.
 */
export function mealPortionG(dailyG: number): number {
  if (dailyG <= 0) return 0
  return Math.ceil(dailyG / 5) * 5
}

/**
 * 토퍼 — 100g 동결건조 고정 팩. 사이클 총 필요량을 100g 팩 단위로 **무조건
 * 올림** (사장님 2026-07-19: 절대 내림 없음. 이전엔 사료관리법 ±5% 내 floor
 * 허용이었으나 폐지 — 처방량 미만 발송 자체를 없앤다).
 * 단, 토퍼 자체가 2026-07-13 폐지라 새 처방은 전부 0 — 옛 저장분 호환 경로.
 */
export function topperPacksForCycle(cycleG: number): {
  packs: number
  deliveredG: number
} {
  if (cycleG <= 0) return { packs: 1, deliveredG: 100 }
  const packG = 100
  const packs = Math.max(1, Math.ceil(cycleG / packG))
  return { packs, deliveredG: packs * packG }
}

/**
 * 라인 사이클 총액(= 청구에 들어가는 최종가) — 원값 × 팩수를 **100원 단위
 * 무조건 올림, 총액 레벨에서 한 번만**.
 *
 * ★사장님 2026-07-19: 팩당 가격을 먼저 올림하고 ×14 하면 올림이 14배 증폭
 * (최대 +1,400원/라인)된다. 올림은 최종가에서 딱 한 번 — 고객에게 정직하고
 * 원 단위 지저분함도 없다.
 */
export function lineCycleTotal(
  unitPricePer100g: number,
  packG: number,
  packs: number,
): number {
  return Math.ceil(((packG / 100) * unitPricePer100g * packs) / 100) * 100
}

/**
 * 팩당 **표시** 가격 = 최종가 ÷ 팩수, 1원 단위가 나오면 10원 단위 **올림**.
 *
 * ★사장님 2026-07-19: "1팩당 가격은 무조건 최종가격에서 나누기. 1원 단위로
 * 나오면 10원 단위로 올림." 올림 방향이라 팩당가 × 팩수 ≥ 최종가 — 고객이
 * 팩당가로 검산하면 총액이 항상 같거나 **더 싸게** 나오므로 올림이 드러나지
 * 않는다(내림이면 총액이 더 비싸져 들킨다).
 */
export function displayPricePerPack(cycleTotal: number, packs: number): number {
  if (packs <= 0) return 0
  return Math.ceil(cycleTotal / packs / 10) * 10
}

/**
 * 처방 + 화식 비율 + 제품 → 배송 항목 목록.
 *
 * 가용성 게이트(활성 제품 없는 라인 재분배) + 박스 2종 스냅까지 여기서 처리하므로,
 * 저장된 formula 가 게이트 이전 버전이어도 박스는 항상 100% 충족한다.
 */
export function computeBoxItems<P extends BoxProduct>(input: {
  formula: Pick<Formula, 'lineRatios' | 'toppers' | 'dailyKcal'>
  /** 화식 비율 티어 — 30(곁들임) / 50(반반) / 100(완전). */
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
    const cycleTotal = lineCycleTotal(unitPrice, mealG, cycleDays)
    const listCycleTotal = lineCycleTotal(product.price, mealG, cycleDays)
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
      cycleTotal,
      listCycleTotal,
      pricePerPack: displayPricePerPack(cycleTotal, cycleDays),
      listPricePerPack: displayPricePerPack(listCycleTotal, cycleDays),
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
      // 토퍼는 100g 표준 팩 → 총액 = 단가 × 팩수 (이미 100원 단위, 올림 불요)
      cycleTotal: unitPrice * packs,
      listCycleTotal: product.price * packs,
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
 * ★합산은 cycleTotal(라인 최종가) — pricePerPack(표시가)로 합치면 10원 올림이
 * 팩수만큼 증폭되므로 절대 금지.
 */
export function priceBox<P extends BoxProduct>(
  items: Array<BoxItem<P>>,
): BoxPrice {
  const subtotal = subscribableItems(items).reduce(
    (s, it) => s + it.cycleTotal,
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
