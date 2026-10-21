/**
 * 할인 고르기 — 최대 할인 금액(사장님 2026-10-19 "50% · 최대 5만원")이 실제 숫자로 지켜지나.
 *
 * 이건 **돈**이다. 상한을 안 지키면 큰 박스에서 10만원 넘게 깎이고, 상한 걸린 이벤트를 비율로 견주면
 * 더 많이 깎는 이웃 할인을 이겨 고객이 덜 받는다. 상한 없는 예전 이벤트는 **한 원도** 달라지면 안 된다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickDiscount } from './discount-pick.ts'
import { capPromotionDiscount, formatPromoCap } from '../promotions.ts'

const NO_TIER = { rate: 0, label: '' }
const TIER10 = { rate: 0.1, label: '나무 등급 10%' }
const EVENT = (rate: number, maxDiscount: number | null) => ({ rate, maxDiscount, label: '이벤트 할인' })

test('상한 아래 박스 — 50% 그대로(곁들임 2주 90,900원 → 45,450원)', () => {
  const r = pickDiscount({ subtotal: 90900, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0 })
  assert.deepEqual(r, { kind: 'promotion', discountAmount: 45450, label: '이벤트 할인' })
})

test('상한 위 박스 — 5만원에서 멈춘다(240,000원 → 50,000원, 50%면 120,000원)', () => {
  const r = pickDiscount({ subtotal: 240000, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0 })
  assert.equal(r.kind, 'promotion')
  assert.equal(r.discountAmount, 50000)
})

test('경계 — 정확히 100,000원이면 50,000원(상한과 같다)', () => {
  assert.equal(pickDiscount({ subtotal: 100000, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0 }).discountAmount, 50000)
  assert.equal(pickDiscount({ subtotal: 100002, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0 }).discountAmount, 50000)
})

test('상한 없는 예전 이벤트 — 예전 계산과 한 원도 다르지 않다', () => {
  for (const subtotal of [1, 99, 90900, 153100, 240001, 1234567]) {
    for (const rate of [0.1, 0.15, 0.3, 0.5]) {
      const r = pickDiscount({ subtotal, tier: NO_TIER, promo: EVENT(rate, null), neighborRate: 0 })
      assert.equal(r.discountAmount, Math.min(Math.floor(subtotal * rate), subtotal), `${subtotal}×${rate}`)
    }
  }
})

test('상한 걸린 이벤트 vs 이웃 할인 — 실제로 더 많이 깎는 쪽(비율로 견주면 이벤트가 이겨 고객이 덜 받는다)', () => {
  // 240,000원: 이벤트 50%(최대 5만) = 50,000 · 이웃 30% = 72,000 → 이웃.
  const r = pickDiscount({ subtotal: 240000, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0.3 })
  assert.equal(r.kind, 'neighbor')
  assert.equal(r.discountAmount, 72000)
  // 90,900원: 이벤트 45,450 · 이웃 30% 27,270 → 이벤트.
  assert.equal(pickDiscount({ subtotal: 90900, tier: NO_TIER, promo: EVENT(0.5, 50000), neighborRate: 0.3 }).kind, 'promotion')
})

test('금액이 같으면 한 번 쓰는 할인은 아껴 둔다 — 이웃 할인 50% = 이벤트 50%(홀수 금액이어도)', () => {
  for (const subtotal of [90900, 90901, 77777]) {
    const r = pickDiscount({ subtotal, tier: NO_TIER, promo: EVENT(0.5, null), neighborRate: 0.5 })
    assert.equal(r.kind, 'promotion', `${subtotal}: 같은 금액인데 이웃 할인을 써 버렸다`)
  }
})

test('상한 걸린 이벤트 vs 나무 등급 10% — 등급이 더 많이 깎는 큰 박스면 등급(이벤트는 남겨 둔다)', () => {
  // 600,000원: 이벤트 = 50,000 · 등급 10% = 60,000 → 등급.
  const big = pickDiscount({ subtotal: 600000, tier: TIER10, promo: EVENT(0.5, 50000), neighborRate: 0 })
  assert.deepEqual(big, { kind: 'tier', discountAmount: 60000, label: '나무 등급 10%' })
  // 500,000원: 둘 다 50,000 → 같으면 등급.
  assert.equal(pickDiscount({ subtotal: 500000, tier: TIER10, promo: EVENT(0.5, 50000), neighborRate: 0 }).kind, 'tier')
  // 153,100원: 이벤트 50,000 · 등급 15,310 → 이벤트.
  assert.equal(pickDiscount({ subtotal: 153100, tier: TIER10, promo: EVENT(0.5, 50000), neighborRate: 0 }).kind, 'promotion')
})

test('할인 없음 · 0원 박스', () => {
  assert.deepEqual(pickDiscount({ subtotal: 90900, tier: NO_TIER, promo: null, neighborRate: 0 }), { kind: 'none', discountAmount: 0, label: '' })
  assert.equal(pickDiscount({ subtotal: 0, tier: TIER10, promo: EVENT(0.5, 50000), neighborRate: 0.5 }).discountAmount, 0)
})

test('capPromotionDiscount — 이상한 상한이면 깎지 않는다(모르는 상한으로 비율대로 깎으면 약속보다 더 깎는다)', () => {
  assert.equal(capPromotionDiscount(120000, 50000), 50000)
  assert.equal(capPromotionDiscount(30000, 50000), 30000)
  assert.equal(capPromotionDiscount(30000, null), 30000)
  assert.equal(capPromotionDiscount(30000, undefined), 30000)
  assert.equal(capPromotionDiscount(30000, 0), 0)
  assert.equal(capPromotionDiscount(30000, Number.NaN), 0)
  assert.equal(capPromotionDiscount(0, 50000), 0)
})

test('formatPromoCap — 화면 문구', () => {
  assert.equal(formatPromoCap(50000), '5만원')
  assert.equal(formatPromoCap(100000), '10만원')
  assert.equal(formatPromoCap(35000), '35,000원')
})
