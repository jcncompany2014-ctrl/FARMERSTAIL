/**
 * stock.ts unit tests — Node native test runner.
 *
 * `node --experimental-strip-types --test` 로 실행. vitest 가 Windows App Control
 * 환경에서 native binding 이 차단돼 못 돌아가, 의존성 0 짜리 built-in runner
 * 로 전환. 동일 assert 문법 (node:assert/strict) 을 쓰므로 CI (Linux) 에서도
 * 그대로 동작.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  STOCK_LOW_THRESHOLD,
  isSoldOut,
  maxOrderable,
  stockMessage,
  stockState,
} from './stock.ts'

describe('stockState', () => {
  it('treats null / undefined as out-of-stock (fail-safe)', () => {
    assert.equal(stockState(null), 'out')
    assert.equal(stockState(undefined), 'out')
  })

  it('returns "out" for zero or negative stock', () => {
    assert.equal(stockState(0), 'out')
    assert.equal(stockState(-3), 'out')
  })

  it('returns "low" for positive stock at or below threshold', () => {
    assert.equal(stockState(1), 'low')
    assert.equal(stockState(STOCK_LOW_THRESHOLD), 'low')
  })

  it('returns "in_stock" above threshold', () => {
    assert.equal(stockState(STOCK_LOW_THRESHOLD + 1), 'in_stock')
    assert.equal(stockState(1000), 'in_stock')
  })

  it('accepts a custom threshold', () => {
    assert.equal(stockState(8, 10), 'low')
    assert.equal(stockState(11, 10), 'in_stock')
  })
})

describe('isSoldOut', () => {
  const cases: Array<[number | null | undefined, boolean]> = [
    [null, true],
    [undefined, true],
    [0, true],
    [-1, true],
    [1, false],
    [100, false],
  ]
  for (const [stock, expected] of cases) {
    it(`isSoldOut(${String(stock)}) → ${expected}`, () => {
      assert.equal(isSoldOut(stock), expected)
    })
  }
})

describe('maxOrderable', () => {
  it('returns 0 when stock is falsy / zero / negative', () => {
    assert.equal(maxOrderable(null), 0)
    assert.equal(maxOrderable(undefined), 0)
    assert.equal(maxOrderable(0), 0)
    assert.equal(maxOrderable(-10), 0)
  })

  it('caps at hardMax (default 99)', () => {
    assert.equal(maxOrderable(5000), 99)
    assert.equal(maxOrderable(99), 99)
    assert.equal(maxOrderable(100), 99)
  })

  it('returns stock when below hardMax', () => {
    assert.equal(maxOrderable(3), 3)
  })

  it('honors a custom hardMax', () => {
    assert.equal(maxOrderable(50, 10), 10)
    assert.equal(maxOrderable(5, 10), 5)
  })
})

describe('stockMessage', () => {
  it('returns "품절" when out of stock', () => {
    assert.equal(stockMessage(0), '품절')
    assert.equal(stockMessage(null), '품절')
  })

  it('returns a numeric countdown when low', () => {
    assert.equal(stockMessage(3), '재고 3개 남음')
    assert.equal(
      stockMessage(STOCK_LOW_THRESHOLD),
      `재고 ${STOCK_LOW_THRESHOLD}개 남음`,
    )
  })

  it('returns empty string when in stock (no noise)', () => {
    assert.equal(stockMessage(50), '')
  })
})
