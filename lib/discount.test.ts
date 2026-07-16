/**
 * 자동 할인 — 규칙은 **하나뿐**이다 (사장님 확정 2026-07-16).
 *
 *   나무 등급(스탬프 50개) · 매 주문 10%. 끝.
 *
 * 예전엔 첫주문 50% · 꽃 반기 25% · 열매 분기 20% · 생일 20% 가 있었고 "스택 금지·
 * 최댓값 1개·슬롯 한도" 규칙이 딸려 있었다. 전부 걷어냈다.
 *
 * # 이 테스트가 지키는 것
 * 할인은 **돈**이다. 실수하면 마진이 새거나(과할인) 고객이 화낸다(미적용).
 *  1. 나무 아닌 등급엔 **절대** 할인이 없다 — 폐지한 규칙이 슬며시 돌아오면 깨진다.
 *  2. 등급 없음(null)도 할인 없음 — 신규가 공짜로 받으면 안 된다.
 *  3. 할인 금액은 내림(소비자 유리)이고 subtotal 을 넘지 않는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAutoDiscount,
  applyDiscount,
  TIER_DISCOUNT,
  MATE_RATE,
} from './discount.ts'
import { TIERS } from './tiers.ts'

describe('할인 규칙 — 나무 10% 하나뿐', () => {
  it('나무면 매 주문 10%', () => {
    const d = computeAutoDiscount({ tier: 'mate' })
    assert.equal(d.rate, 0.1)
    assert.equal(d.reason, 'tier')
    assert.equal(d.label, '나무 등급 할인')
  })

  it('★나무를 뺀 모든 등급은 할인 0 (폐지한 규칙이 돌아오면 깨진다)', () => {
    for (const t of TIERS) {
      if (t.key === 'mate') continue
      const d = computeAutoDiscount({ tier: t.key })
      assert.equal(d.rate, 0, `${t.label}(${t.key}) 에 할인이 생겼다`)
      assert.equal(d.reason, 'none')
    }
  })

  it('등급 없음(스탬프 10개 미만)도 할인 0', () => {
    const d = computeAutoDiscount({ tier: null })
    assert.equal(d.rate, 0)
    assert.equal(d.reason, 'none')
  })

  it('할인이 있는 등급은 나무 **하나뿐**이다', () => {
    const withDiscount = Object.entries(TIER_DISCOUNT).filter(([, v]) => v != null)
    assert.deepEqual(withDiscount, [['mate', MATE_RATE]])
  })

  it('사유는 tier / none 두 가지뿐 (first_order·birthday 는 폐지)', () => {
    const reasons = new Set(
      [null, ...TIERS.map((t) => t.key)].map((t) => computeAutoDiscount({ tier: t }).reason),
    )
    assert.deepEqual([...reasons].sort(), ['none', 'tier'])
  })
})

describe('할인 금액 — 소비자에게 유리하게, 안전하게', () => {
  it('원 단위 내림 (소비자 유리)', () => {
    // 10% of 50,005 = 5000.5 → 5000
    assert.equal(applyDiscount(50_005, 0.1), 5000)
  })

  it('subtotal 을 절대 넘지 않는다 (음수 청구 방지)', () => {
    assert.equal(applyDiscount(10_000, 1.5), 10_000)
  })

  it('할인율 0·음수·subtotal 0 이면 0', () => {
    assert.equal(applyDiscount(10_000, 0), 0)
    assert.equal(applyDiscount(10_000, -0.5), 0)
    assert.equal(applyDiscount(0, 0.1), 0)
  })

  it('나무 등급 실제 청구 예 — 5만원 박스는 4만5천원', () => {
    const d = computeAutoDiscount({ tier: 'mate' })
    assert.equal(50_000 - applyDiscount(50_000, d.rate), 45_000)
  })
})
