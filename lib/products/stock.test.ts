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



