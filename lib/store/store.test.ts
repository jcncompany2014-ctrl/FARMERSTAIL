/**
 * 웹 가게(단품) — 상품표·배송비·출고일·급여량·장바구니 회귀 테스트.
 *
 * 보호 대상: 시안 숫자(사장님 10/10 "시안 숫자 그대로")가 코드 정본에서 그대로 나오는지,
 * 그리고 장바구니가 저장된 값을 믿지 않고 상품표에서 다시 계산하는지.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STORE_ITEMS,
  STORE_RECIPES,
  TRIAL_ITEM,
  meatLine,
  toppingLine,
  storeItem,
  subscriptionPer100g,
  subscriptionSaving,
  isStoreItemId,
  recipeIntro,
  alternativeRecipes,
  alternativeAdvice,
} from './catalog.ts'
import { SKU_PRICING } from '../pricing.ts'
import { shippingFeeFor, storeShipDate, shipDateLabel, untilFreeShipping, SHIPPING_FEE } from './shipping.ts'
import { feedingSummary, packFractionLabel } from './feeding.ts'
import { normalizeCart, cartSummary, setQty, addToCart, cartCount } from './cart.ts'
import { orderItemsFromCart, orderNameFor, normalizeMobile, validateRecipient } from './order.ts'
import { storeOrderNumber, isStoreOrderNumber } from './order-number.ts'
import { orderReservedStock } from '../commerce/stock-gate.ts'

test('상품표: 500g = 정가(lib/pricing), 1kg = 500g×2 의 5% 할인, 체험팩 19,900원', () => {
  for (const r of STORE_RECIPES) {
    assert.equal(storeItem(`${r}-500g`).price, SKU_PRICING[r].listPack500g)
    assert.equal(storeItem(`${r}-500g`).packs, 5)
    assert.equal(storeItem(`${r}-1kg`).packs, 10)
  }
  assert.equal(storeItem('chicken-1kg').price, 45_600)
  assert.equal(storeItem('duck-1kg').price, 51_300)
  assert.equal(storeItem('pork-1kg').price, 57_950)
  assert.equal(storeItem('beef-1kg').price, 78_850)
  assert.equal(TRIAL_ITEM.price, 19_900)
  assert.equal(TRIAL_ITEM.listPrice, 24_600)
  assert.ok(TRIAL_ITEM.price < TRIAL_ITEM.listPrice)
})

test('1kg 도 앱 정기배송(100g 구독가)보다 비싸다 — 앱으로 갈 이유를 남긴다(기획서 D5)', () => {
  for (const r of STORE_RECIPES) {
    const per100 = storeItem(`${r}-1kg`).price / 10
    assert.ok(per100 > subscriptionPer100g(r), `${r} 1kg 100g 값(${per100})이 구독가(${subscriptionPer100g(r)}) 이하`)
    assert.ok(subscriptionSaving(storeItem(`${r}-500g`)) > 0)
  }
  // 시안: "같은 양을 앱 정기배송으로 받으면 3,600원 덜 내요"(닭고기 500g).
  assert.equal(subscriptionSaving(storeItem('chicken-500g')), 3_600)
  assert.equal(subscriptionSaving(TRIAL_ITEM), 0)
})

test('카드 한 줄 원재료 — 정본(lib/recipe-ingredients)에서, 고기 이름 반복 없이', () => {
  assert.equal(meatLine('chicken'), '닭가슴살·간·염통')
  assert.equal(meatLine('duck'), '오리 안심·간·염통')
  assert.equal(meatLine('pork'), '흑돼지 뒷다리살·간·염통')
  assert.equal(meatLine('beef'), '한우 목심·간·염통')
  assert.equal(toppingLine('chicken'), '브로콜리·블루베리')
  assert.ok(!Object.values(STORE_ITEMS).some((it) => /연어/.test(it.name)), '연어는 팔지 않는다')
})

test('상세 한 줄·다른 레시피 권유 — 정본 원재료·알레르기 교차 반응에서', () => {
  assert.equal(recipeIntro('chicken'), '닭가슴살에 염통과 간까지, 브로콜리와 블루베리를 더했어요')
  assert.equal(recipeIntro('pork'), '흑돼지 뒷다리살에 염통과 간까지, 무와 양배추를 더했어요')
  // 오리는 닭과 교차 반응 — 닭고기 대안에서 빠진다(시안의 "오리고기나 한우"를 정본이 고친다).
  assert.ok(!alternativeRecipes('chicken').includes('duck'))
  assert.ok(!alternativeRecipes('duck').includes('chicken'))
  for (const r of STORE_RECIPES) assert.ok(!alternativeRecipes(r).includes(r))
  assert.equal(alternativeAdvice('chicken'), '닭고기를 먹고 탈이 난 적 있는 아이라면 흑돼지나 한우 레시피를 골라 주세요.')
})

test('상품 id 판정 — 상품표에 없는 것은 거른다', () => {
  assert.ok(isStoreItemId('chicken-500g'))
  assert.ok(isStoreItemId('trial-4set'))
  assert.ok(!isStoreItemId('salmon-500g'))
  assert.ok(!isStoreItemId('toString'))
  assert.ok(!isStoreItemId(undefined))
})

test('배송비 4,000원 · 5만 원 이상 무료 · 빈 장바구니 0', () => {
  assert.equal(shippingFeeFor(0), 0)
  assert.equal(shippingFeeFor(24_000), SHIPPING_FEE)
  assert.equal(shippingFeeFor(49_990), 4_000)
  assert.equal(shippingFeeFor(50_000), 0)
  assert.equal(untilFreeShipping(24_000), 26_000)
  assert.equal(untilFreeShipping(60_000), 0)
})

test('출고일 = 오늘 다음의 첫 화·목 (출고 전날 밤 12시 마감)', () => {
  assert.equal(storeShipDate('2026-10-07'), '2026-10-08') // 수 → 목
  assert.equal(storeShipDate('2026-10-08'), '2026-10-13') // 목 → 다음 화
  assert.equal(storeShipDate('2026-10-09'), '2026-10-13') // 금 → 화
  assert.equal(storeShipDate('2026-10-10'), '2026-10-13') // 토 → 화
  assert.equal(storeShipDate('2026-10-11'), '2026-10-13') // 일 → 화
  assert.equal(storeShipDate('2026-10-12'), '2026-10-13') // 월 → 화
  assert.equal(storeShipDate('2026-10-13'), '2026-10-15') // 화 → 목
  assert.equal(shipDateLabel('2026-10-08'), '10월 8일(목)')
  assert.equal(shipDateLabel('2026-12-31'), '12월 31일(목)')
})

test('급여량 — 시안 표(닭고기·곁들임)와 같은 숫자가 계산식에서 나온다', () => {
  const s3 = feedingSummary(3, 'chicken', 'light', 500)
  assert.deepEqual([s3.gramsPerDay, s3.days], [52, 9])
  const s5 = feedingSummary(5, 'chicken', 'light', 500)
  assert.deepEqual([s5.gramsPerDay, s5.days, s5.costPerDay], [76, 6, 3_650])
  const s10 = feedingSummary(10, 'chicken', 'light', 500)
  assert.deepEqual([s10.gramsPerDay, s10.days, s10.costPerDay], [127, 3, 6_100])
  // 1kg 이면 약 13일(시안 "약 13일분").
  assert.equal(feedingSummary(5, 'chicken', 'light', 1000).days, 13)
  // 화식만이면 양이 늘고 날이 준다.
  const full = feedingSummary(5, 'chicken', 'full', 500)
  assert.ok(full.gramsPerDay > s5.gramsPerDay && full.days < s5.days)
  assert.equal(packFractionLabel(76), '100g 팩 ¾쯤')
  assert.equal(packFractionLabel(100), '100g 팩 1개')
})

test('장바구니는 저장된 값을 믿지 않는다 — 없는 상품·이상한 수량은 버리고 같은 상품은 합친다', () => {
  const raw = [
    { id: 'chicken-500g', qty: 2 },
    { id: 'chicken-500g', qty: 1, price: 1 },
    { id: 'salmon-500g', qty: 3 },
    { id: 'duck-1kg', qty: -4 },
    { id: 'beef-500g', qty: 99 },
    'junk',
  ]
  assert.deepEqual(normalizeCart(raw), [
    { id: 'chicken-500g', qty: 3 },
    { id: 'beef-500g', qty: 10 },
  ])
  assert.deepEqual(normalizeCart('not an array'), [])
})

test('주문 품목 — 품목 합 = 상품 금액(체험팩은 4종 100g 한 팩씩 4,975원), 주문 이름·주문번호', () => {
  const lines = [
    { id: 'chicken-500g' as const, qty: 2 },
    { id: 'trial-4set' as const, qty: 1 },
    { id: 'beef-1kg' as const, qty: 1 },
  ]
  const items = orderItemsFromCart(lines)
  const sum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  assert.equal(sum, cartSummary(lines).subtotal)
  assert.ok(items.every((it) => Number.isInteger(it.unit_price) && it.line_total === it.unit_price * it.quantity))
  const trial = items.filter((it) => it.variant_name === '4종 체험팩')
  assert.equal(trial.length, 4)
  assert.ok(trial.every((it) => it.unit_price === 4_975))
  assert.equal(TRIAL_ITEM.price % STORE_RECIPES.length, 0, '체험팩 값이 4로 나누어떨어지지 않으면 품목 합이 어긋난다')
  assert.equal(orderNameFor(lines), '닭고기 화식 500g 외 2건')
  const no = storeOrderNumber(new Date('2026-10-10T15:30:00Z'), () => 0)
  assert.equal(no, 'FTS-20261011-AAAAAA') // KST 날짜(10/11 00:30)
  assert.ok(isStoreOrderNumber(no) && !isStoreOrderNumber('FT-20261010-1234'))
})

test('받는 분 검사 — 휴대폰 번호 정리·주소는 우편번호와 함께', () => {
  assert.equal(normalizeMobile('01012345678'), '010-1234-5678')
  assert.equal(normalizeMobile('010-123-4567'), null) // 010 은 뒤 8자리 고정(lib/phone)
  assert.equal(normalizeMobile('011-234-5678'), '011-234-5678')
  assert.equal(normalizeMobile('02-123-4567'), null)
  const ok = validateRecipient({ name: ' 보호자 ', phone: '010 1234 5678', zip: '21990', address: '인천 연수구 송도과학로 50', addressDetail: '121호', memo: '문 앞' })
  assert.ok(ok.ok && ok.value.name === '보호자' && ok.value.phone === '010-1234-5678')
  assert.equal(validateRecipient({ name: '보호자', phone: '01012345678', zip: '', address: '' }).ok, false)
})

test('재고 되돌림 판정 — 정기배송·웹 가게 주문은 재고를 잡지 않았다(규칙172)', () => {
  assert.equal(orderReservedStock({ subscription_id: 'sub', order_number: 'FT-1' }), false)
  assert.equal(orderReservedStock({ subscription_id: null, order_number: 'FTS-20261010-AAAAAA' }), false)
  assert.equal(orderReservedStock({ subscription_id: null, order_number: 'FT-20260601-OLD' }), true)
})

test('장바구니 합계 — 시안 예시(닭 500g 28,000원 / 닭+오리 51,000원 무료배송)', () => {
  const one = cartSummary([{ id: 'chicken-500g', qty: 1 }])
  assert.deepEqual([one.subtotal, one.shippingFee, one.total, one.untilFree], [24_000, 4_000, 28_000, 26_000])
  const two = cartSummary([
    { id: 'chicken-500g', qty: 1 },
    { id: 'duck-500g', qty: 1 },
  ])
  assert.deepEqual([two.subtotal, two.shippingFee, two.total], [51_000, 0, 51_000])
  let lines = addToCart([], 'trial-4set')
  lines = setQty(lines, 'trial-4set', 3)
  assert.equal(cartCount(lines), 3)
  lines = setQty(lines, 'trial-4set', 0)
  assert.deepEqual(lines, [])
})
