import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAutoDiscount,
  applyDiscount,
  tierSlotRange,
  FIRST_ORDER_RATE,
  type AutoDiscountInput,
} from './discount.ts'

/**
 * lib/discount.ts — 자동 할인 정책 (쿠폰 대체) pure 정책 단위 테스트.
 *
 * 첫주문 / 등급(꽃 반기·열매 분기·나무 매번) / 생일 / 스택 금지 / 금액 / 슬롯 경계.
 * 결제·DB 연결은 통합/e2e 위임. 여기선 순수 결정만.
 */

function makeInput(over: Partial<AutoDiscountInput> = {}): AutoDiscountInput {
  return {
    isFirstPaidOrder: false,
    tier: 'seed',
    tierDiscountUsedThisSlot: false,
    isDogBirthdayMonth: false,
    birthdayDiscountUsedThisYear: false,
    ...over,
  }
}

describe('computeAutoDiscount — 첫 주문', () => {
  it('첫 주문이면 등급 무관 50%', () => {
    const d = computeAutoDiscount(makeInput({ isFirstPaidOrder: true, tier: 'mate' }))
    assert.equal(d.reason, 'first_order')
    assert.equal(d.rate, FIRST_ORDER_RATE)
  })
  it('첫 주문은 생일·등급보다 우선', () => {
    const d = computeAutoDiscount(
      makeInput({ isFirstPaidOrder: true, tier: 'bloom', isDogBirthdayMonth: true }),
    )
    assert.equal(d.reason, 'first_order')
    assert.equal(d.rate, 0.5)
  })
})

describe('computeAutoDiscount — 등급 할인 (슬롯)', () => {
  it('씨앗·새싹은 등급 할인 없음', () => {
    assert.equal(computeAutoDiscount(makeInput({ tier: 'seed' })).rate, 0)
    assert.equal(computeAutoDiscount(makeInput({ tier: 'sprout' })).rate, 0)
  })
  it('꽃(반기 1회) — 이번 슬롯 미사용이면 25%', () => {
    const d = computeAutoDiscount(makeInput({ tier: 'bloom', tierDiscountUsedThisSlot: false }))
    assert.equal(d.reason, 'tier')
    assert.equal(d.rate, 0.25)
  })
  it('꽃 — 이번 슬롯 이미 사용했으면 없음', () => {
    assert.equal(
      computeAutoDiscount(makeInput({ tier: 'bloom', tierDiscountUsedThisSlot: true })).rate,
      0,
    )
  })
  it('열매(분기 1회) — 이번 슬롯 미사용이면 20%, 사용했으면 0', () => {
    assert.equal(
      computeAutoDiscount(makeInput({ tier: 'fruit', tierDiscountUsedThisSlot: false })).rate,
      0.2,
    )
    assert.equal(
      computeAutoDiscount(makeInput({ tier: 'fruit', tierDiscountUsedThisSlot: true })).rate,
      0,
    )
  })
  it('나무(매 청구) — 슬롯 사용 여부 무관하게 항상 10%', () => {
    const d = computeAutoDiscount(makeInput({ tier: 'mate', tierDiscountUsedThisSlot: true }))
    assert.equal(d.reason, 'tier')
    assert.equal(d.rate, 0.1)
  })
})

describe('computeAutoDiscount — 생일(강아지 생일 月)', () => {
  it('생일 月 + 올해 미사용 → 20%', () => {
    const d = computeAutoDiscount(makeInput({ tier: 'seed', isDogBirthdayMonth: true }))
    assert.equal(d.reason, 'birthday')
    assert.equal(d.rate, 0.2)
  })
  it('생일 月이라도 올해 이미 받았으면 없음', () => {
    assert.equal(
      computeAutoDiscount(
        makeInput({ tier: 'seed', isDogBirthdayMonth: true, birthdayDiscountUsedThisYear: true }),
      ).rate,
      0,
    )
  })
})

describe('computeAutoDiscount — 스택 금지(가장 큰 1개)', () => {
  it('꽃(25%) + 생일(20%) → 25% 등급', () => {
    const d = computeAutoDiscount(
      makeInput({ tier: 'bloom', tierDiscountUsedThisSlot: false, isDogBirthdayMonth: true }),
    )
    assert.equal(d.reason, 'tier')
    assert.equal(d.rate, 0.25)
  })
  it('나무(10%) + 생일(20%) → 20% 생일', () => {
    const d = computeAutoDiscount(makeInput({ tier: 'mate', isDogBirthdayMonth: true }))
    assert.equal(d.reason, 'birthday')
    assert.equal(d.rate, 0.2)
  })
  it('꽃 슬롯 소진 + 생일 月 → 생일 20% 로 폴백', () => {
    const d = computeAutoDiscount(
      makeInput({ tier: 'bloom', tierDiscountUsedThisSlot: true, isDogBirthdayMonth: true }),
    )
    assert.equal(d.reason, 'birthday')
    assert.equal(d.rate, 0.2)
  })
  it('해당 없음 → none', () => {
    assert.equal(computeAutoDiscount(makeInput({ tier: 'seed' })).reason, 'none')
  })
})

describe('applyDiscount — 금액 적용', () => {
  it('30000 * 50% = 15000', () => {
    assert.equal(applyDiscount(30000, 0.5), 15000)
  })
  it('원 단위 내림 — 33333 * 10% = 3333', () => {
    assert.equal(applyDiscount(33333, 0.1), 3333)
  })
  it('rate 0 / subtotal 0 → 0', () => {
    assert.equal(applyDiscount(30000, 0), 0)
    assert.equal(applyDiscount(0, 0.5), 0)
  })
})

describe('tierSlotRange — 슬롯 경계', () => {
  it('분기(4슬롯): 5월 → Q2 [04-01, 07-01)', () => {
    assert.deepEqual(tierSlotRange(4, '2026-05-10'), {
      start: '2026-04-01',
      end: '2026-07-01',
    })
  })
  it('분기(4슬롯): 1월 → Q1 [01-01, 04-01)', () => {
    assert.deepEqual(tierSlotRange(4, '2026-01-01'), {
      start: '2026-01-01',
      end: '2026-04-01',
    })
  })
  it('분기(4슬롯): 12월 → Q4 [10-01, 다음해 01-01)', () => {
    assert.deepEqual(tierSlotRange(4, '2026-12-31'), {
      start: '2026-10-01',
      end: '2027-01-01',
    })
  })
  it('반기(2슬롯): 5월 → H1 [01-01, 07-01)', () => {
    assert.deepEqual(tierSlotRange(2, '2026-05-10'), {
      start: '2026-01-01',
      end: '2026-07-01',
    })
  })
  it('반기(2슬롯): 9월 → H2 [07-01, 다음해 01-01)', () => {
    assert.deepEqual(tierSlotRange(2, '2026-09-15'), {
      start: '2026-07-01',
      end: '2027-01-01',
    })
  })
})
