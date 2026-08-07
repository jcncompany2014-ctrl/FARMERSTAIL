import test from 'node:test'
import assert from 'node:assert/strict'
import { computeBoxItems, priceBox } from './boxPricing.ts'
import { TOPPER_TO_SLUG } from './skuMap.ts'

/**
 * 금액이 **유한한 수**인지 — 2026-08-08 금액 감사.
 *
 * # 왜
 * `boxPricing` 의 토퍼 계산이 admin 입력 kcal 을 `?? TOPPER_KCAL_PER_100G`
 * 로 받았다. `??` 는 null/undefined 만 잡으므로 **0 을 입력하면** 그 0 이
 * 분모가 되어 `total = Infinity` 가 됐다.
 *
 * 그런데 하류 금액 가드가 전부 `!(total > 0)` 형태라 **Infinity 를 통과시켰다**
 * (`Infinity > 0` 은 참이다). 결과: 청구 검문소가 매일 오탐 알림을 내고,
 * JSON 직렬화에서 `null` 이 되어 NOT NULL 위반으로 엉뚱한 곳에서 터진다.
 *
 * ★슬러그는 상수에서 가져온다 — 이 파일의 형제 테스트(boxPricing.test.ts)가
 *  손으로 적은 슬러그가 실물과 달라 **항목 0개 위에서 전부 통과**하던 사고를
 *  겪었다(그 파일 주석 참조). 같은 실수를 반복하지 않는다.
 */

const CHICKEN = 'chicken-basic'
const BEEF = 'beef-premium'
const TOPPER_VEG = TOPPER_TO_SLUG.vegetable

function products(topperKcal: unknown) {
  return {
    [CHICKEN]: {
      slug: CHICKEN,
      price: 4800,
      sale_price: 4080,
      stock: 99,
      is_subscribable: true,
    },
    [BEEF]: {
      slug: BEEF,
      price: 8300,
      sale_price: 7055,
      stock: 99,
      is_subscribable: true,
    },
    [TOPPER_VEG]: {
      slug: TOPPER_VEG,
      price: 3000,
      sale_price: null,
      stock: 99,
      is_subscribable: true,
      nutrition_facts: { calories_kcal_per_100g: topperKcal },
    },
  }
}

const formula = {
  lineRatios: { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 },
  toppers: { vegetable: 0.2, protein: 0 },
  dailyKcal: 400,
}

test('★토퍼 kcal 이 0 이어도 total 이 Infinity 가 되지 않는다', () => {
  const items = computeBoxItems({
    formula,
    freshRatio: 100,
    products: products(0),
  } as unknown as Parameters<typeof computeBoxItems>[0])
  // 항목이 0개면 아래 검사가 빈 배열 위에서 통과한다 — 먼저 박는다.
  assert.ok(items.length >= 2, `항목이 ${items.length}개다 — 슬러그 확인`)
  const { total } = priceBox(items)
  assert.ok(
    Number.isFinite(total),
    `total 이 유한하지 않다: ${total} — 토퍼 kcal 0 이 분모가 됐다`,
  )
  assert.ok(total > 0)
})

test('토퍼 kcal 이 정상이면 그 값을 쓴다 (폴백이 덮어쓰지 않는다)', () => {
  const withReal = priceBox(
    computeBoxItems({
      formula,
      freshRatio: 100,
      products: products(500),
    } as unknown as Parameters<typeof computeBoxItems>[0]),
  ).total
  const withZero = priceBox(
    computeBoxItems({
      formula,
      freshRatio: 100,
      products: products(0),
    } as unknown as Parameters<typeof computeBoxItems>[0]),
  ).total
  assert.ok(Number.isFinite(withReal) && withReal > 0)
  assert.ok(Number.isFinite(withZero) && withZero > 0)
  // kcal 이 높으면 필요한 그램이 줄어 금액이 더 싸거나 같아야 한다.
  assert.ok(
    withReal <= withZero,
    `kcal 500 이 kcal 0(폴백)보다 비싸다: ${withReal} vs ${withZero}`,
  )
})

test('토퍼 kcal 이 음수·NaN 이어도 유한하다', () => {
  for (const bad of [-1, Number.NaN]) {
    const items = computeBoxItems({
      formula,
      freshRatio: 100,
      products: products(bad),
    } as unknown as Parameters<typeof computeBoxItems>[0])
    const { total } = priceBox(items)
    assert.ok(
      Number.isFinite(total) && total > 0,
      `topperKcal=${String(bad)} → total=${total}`,
    )
  }
})
