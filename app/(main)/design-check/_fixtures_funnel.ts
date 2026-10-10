/**
 * /design-check 예시 값 — 결제 퍼널(레시피 고르기 /plan · 주문하기 /order). 캔버스 S29~S32·C04 와 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 버튼을 눌러도 로그인이 없어 저장·결제되지 않는다.
 *
 * 상품 가격은 **가격 계산 테스트(lib/personalization/boxPricing.test.ts)와 같은 꼴의 예시 값**이다 — 실제 판매가가
 * 아니라서 화면의 금액은 시안 숫자와 다를 수 있다. 금액 계산 자체는 실제와 같은 함수(boxPricing)가 한다.
 */

import type { Formula } from '@/lib/personalization/types'
import type { PlanProduct } from '../dogs/[id]/plan/PlanClient'
import type { OrderProduct, OrderProfileInitial } from '../dogs/[id]/order/OrderClient'

export const FUNNEL_PHOTO = '/sheltie-snow-45.jpg'

/** 닭고기·흑돼지 반반, 하루 600kcal — 추천 이유는 레시피 특성 문장만(시안 S29). */
export const PLAN_FORMULA = {
  lineRatios: { basic: 0, weight: 0.5, skin: 0, premium: 0, joint: 0.5 },
  toppers: { vegetable: 0, protein: 0 },
  dailyKcal: 600,
  reasoning: [],
} as unknown as Formula

const p = (slug: string, price: number): PlanProduct => ({
  slug,
  price,
  sale_price: Math.round(price * 0.85),
  stock: 99,
  is_subscribable: true,
})

export const PLAN_PRODUCTS: Record<string, PlanProduct> = {
  'chicken-basic': p('chicken-basic', 4800),
  'pork-joint': p('pork-joint', 5200),
  'beef-premium': p('beef-premium', 8300),
  'duck-weight': p('duck-weight', 5600),
}

/** 주문하기 — 같은 처방(1번째 박스)·같은 예시 가격. 상품 행은 주문 화면이 쓰는 꼴(OrderProduct). */
export const ORDER_FORMULA = {
  ...(PLAN_FORMULA as unknown as Record<string, unknown>),
  cycleNumber: 1,
} as unknown as Formula

const op = (slug: string, name: string): OrderProduct => ({
  id: `prod-${slug}`,
  name,
  slug,
  price: PLAN_PRODUCTS[slug]!.price,
  sale_price: PLAN_PRODUCTS[slug]!.sale_price,
  image_url: null,
  stock: 99,
  net_weight_g: null,
  is_subscribable: true,
  nutrition_facts: null,
})

export const ORDER_PRODUCTS: Record<string, OrderProduct> = {
  'chicken-basic': op('chicken-basic', '닭고기 화식'),
  'pork-joint': op('pork-joint', '흑돼지 화식'),
}

/** 배송지 — 공개 화면 예시라 실명 대신 '보호자'. */
export const ORDER_PROFILE: OrderProfileInitial = {
  name: '보호자',
  phone: '010-1234-5678',
  zip: '04050',
  address: '서울 마포구 양화로 12',
  address_detail: '3층',
  prefilled: true,
}
