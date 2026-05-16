import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCouponDiscount, type Coupon } from './coupons.ts'

/**
 * lib/coupons.ts — 쿠폰 할인 계산 (pure 함수만 unit test).
 *
 * validateCoupon / applyCouponRedemption / revokeCouponRedemption 는
 * SupabaseClient + RPC 의존이라 integration test 또는 Playwright e2e 위임.
 * 여기서는 computeCouponDiscount pure 정책만:
 *
 *  - percent / fixed 분기
 *  - max_discount cap
 *  - min_order_amount 미달 → 0
 *  - subtotal 초과 → cap to subtotal
 */

function makeCoupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c-1',
    code: 'TEST10',
    name: '테스트 쿠폰',
    description: null,
    discount_type: 'percent',
    discount_value: 10,
    min_order_amount: 0,
    max_discount: null,
    starts_at: null,
    expires_at: null,
    usage_limit: null,
    used_count: 0,
    per_user_limit: null,
    is_active: true,
    ...over,
  }
}

describe('computeCouponDiscount — percent type', () => {
  it('10% × 50000 = 5000', () => {
    const c = makeCoupon({ discount_type: 'percent', discount_value: 10 })
    assert.equal(computeCouponDiscount(c, 50000), 5000)
  })

  it('15% × 30000 = 4500', () => {
    const c = makeCoupon({ discount_type: 'percent', discount_value: 15 })
    assert.equal(computeCouponDiscount(c, 30000), 4500)
  })

  it('소수점 → 내림 (Math.floor)', () => {
    // 50000 * 7 / 100 = 3500. 33333 * 7 / 100 = 2333.31 → 2333
    const c = makeCoupon({ discount_type: 'percent', discount_value: 7 })
    assert.equal(computeCouponDiscount(c, 33333), 2333)
  })

  it('100% → subtotal 전액', () => {
    const c = makeCoupon({ discount_type: 'percent', discount_value: 100 })
    assert.equal(computeCouponDiscount(c, 50000), 50000)
  })
})

describe('computeCouponDiscount — fixed type', () => {
  it('정액 5000원 할인', () => {
    const c = makeCoupon({ discount_type: 'fixed', discount_value: 5000 })
    assert.equal(computeCouponDiscount(c, 50000), 5000)
  })

  it('정액이 subtotal 초과 → subtotal 로 cap', () => {
    const c = makeCoupon({ discount_type: 'fixed', discount_value: 10000 })
    assert.equal(computeCouponDiscount(c, 8000), 8000)
  })
})

describe('computeCouponDiscount — min_order_amount', () => {
  it('subtotal < min → 0 (적용 안 됨)', () => {
    const c = makeCoupon({
      discount_type: 'percent',
      discount_value: 10,
      min_order_amount: 30000,
    })
    assert.equal(computeCouponDiscount(c, 20000), 0)
  })

  it('subtotal == min → 적용 OK', () => {
    const c = makeCoupon({
      discount_type: 'percent',
      discount_value: 10,
      min_order_amount: 30000,
    })
    assert.equal(computeCouponDiscount(c, 30000), 3000)
  })

  it('subtotal > min → 적용 OK', () => {
    const c = makeCoupon({
      discount_type: 'fixed',
      discount_value: 5000,
      min_order_amount: 30000,
    })
    assert.equal(computeCouponDiscount(c, 50000), 5000)
  })
})

describe('computeCouponDiscount — max_discount cap', () => {
  it('percent 할인이 max 초과 → max 로 cap', () => {
    // 20% × 100000 = 20000, but cap 5000
    const c = makeCoupon({
      discount_type: 'percent',
      discount_value: 20,
      max_discount: 5000,
    })
    assert.equal(computeCouponDiscount(c, 100000), 5000)
  })

  it('percent 할인이 max 미만 → 그대로', () => {
    // 5% × 50000 = 2500, cap 5000 (touched X)
    const c = makeCoupon({
      discount_type: 'percent',
      discount_value: 5,
      max_discount: 5000,
    })
    assert.equal(computeCouponDiscount(c, 50000), 2500)
  })

  it('fixed 할인은 보통 max_discount null, 있어도 cap 동일 적용', () => {
    const c = makeCoupon({
      discount_type: 'fixed',
      discount_value: 10000,
      max_discount: 7000,
    })
    assert.equal(computeCouponDiscount(c, 50000), 7000)
  })

  it('max_discount null → cap 없음 (회귀 가드)', () => {
    const c = makeCoupon({
      discount_type: 'percent',
      discount_value: 50,
      max_discount: null,
    })
    assert.equal(computeCouponDiscount(c, 100000), 50000)
  })
})

describe('computeCouponDiscount — 보안 / 회귀 가드', () => {
  it('할인이 subtotal 초과 불가 (음수 결제 차단)', () => {
    // percent 100% 이상도 가능하다 가정 시 subtotal 초과 X
    const c = makeCoupon({ discount_type: 'fixed', discount_value: 999999 })
    const result = computeCouponDiscount(c, 5000)
    assert.equal(result, 5000)
    assert.ok(result <= 5000, '할인 > subtotal — 음수 결제 가능')
  })

  it('min 0, percent 0% → 0 할인', () => {
    const c = makeCoupon({ discount_type: 'percent', discount_value: 0 })
    assert.equal(computeCouponDiscount(c, 50000), 0)
  })

  it('subtotal 0 → 0 할인', () => {
    const c = makeCoupon({ discount_type: 'percent', discount_value: 10 })
    assert.equal(computeCouponDiscount(c, 0), 0)
  })
})
