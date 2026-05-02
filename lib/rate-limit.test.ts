/**
 * rate-limit.ts unit tests — Node native test runner.
 *
 * 모듈이 globalThis 에 store 를 두므로 각 test 마다 store 를 비워서
 * cross-test contamination 방지.
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit } from './rate-limit.ts'

const GLOBAL_KEY = '__farmerstail_rl__'

function clearStore() {
  const g = globalThis as unknown as Record<string, unknown>
  const store = g[GLOBAL_KEY] as Map<string, unknown> | undefined
  if (store) store.clear()
}

function getStoreSize(): number {
  const g = globalThis as unknown as Record<string, unknown>
  const store = g[GLOBAL_KEY] as Map<string, unknown> | undefined
  return store?.size ?? 0
}

describe('rateLimit', () => {
  beforeEach(() => clearStore())

  it('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({
        bucket: 'test',
        key: '1.2.3.4',
        limit: 5,
        windowMs: 60_000,
      })
      assert.equal(r.ok, true, `req ${i + 1} should pass`)
    }
  })

  it('denies requests over the limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit({ bucket: 'test', key: 'ip', limit: 5, windowMs: 60_000 })
    }
    const over = rateLimit({
      bucket: 'test',
      key: 'ip',
      limit: 5,
      windowMs: 60_000,
    })
    assert.equal(over.ok, false)
    assert.equal(over.remaining, 0)
    assert.ok(over.retryAfter > 0, 'retryAfter > 0 when blocked')
    assert.equal(over.headers.get('Retry-After'), String(over.retryAfter))
  })

  it('counts buckets independently', () => {
    rateLimit({ bucket: 'login', key: 'ip', limit: 1, windowMs: 60_000 })
    const otherBucket = rateLimit({
      bucket: 'payment',
      key: 'ip',
      limit: 1,
      windowMs: 60_000,
    })
    assert.equal(otherBucket.ok, true, '별도 버킷은 따로 카운트')
  })

  it('counts keys independently', () => {
    rateLimit({ bucket: 'b', key: 'a', limit: 1, windowMs: 60_000 })
    const otherKey = rateLimit({
      bucket: 'b',
      key: 'b',
      limit: 1,
      windowMs: 60_000,
    })
    assert.equal(otherKey.ok, true, '별도 key 는 따로 카운트')
  })

  it('emits standard RateLimit-* headers on every response', () => {
    const r = rateLimit({
      bucket: 'b',
      key: 'k',
      limit: 10,
      windowMs: 60_000,
    })
    assert.equal(r.headers.get('RateLimit-Limit'), '10')
    assert.equal(r.headers.get('RateLimit-Remaining'), '9')
    assert.ok(r.headers.has('RateLimit-Reset'))
  })

  it('decrements remaining as count grows', () => {
    const a = rateLimit({ bucket: 'b', key: 'k', limit: 3, windowMs: 60_000 })
    const b = rateLimit({ bucket: 'b', key: 'k', limit: 3, windowMs: 60_000 })
    assert.equal(a.remaining, 2)
    assert.equal(b.remaining, 1)
  })

  /**
   * 메모리 가드 회귀 테스트.
   *
   * MAX_ENTRIES = 50_000, EVICT_TARGET = 40_000. attacker 가 IP 별로 1번씩만
   * hit 해서 store 를 무한 성장시키는 시나리오 — 50K 초과로 가도 sweep 이
   * 40K 까지 줄여야 한다.
   */
  it('sweeps store when over MAX_ENTRIES (memory guard)', () => {
    // 50_001 개 unique key 로 1회씩 hit. 이전엔 store size 가 50001 까지
    // 무한 성장했지만, sweep 가드 추가 후엔 EVICT_TARGET (40K) 근처로 감소.
    for (let i = 0; i < 50_001; i++) {
      rateLimit({
        bucket: 'b',
        key: `ip-${i}`,
        limit: 1,
        windowMs: 60_000,
      })
    }
    const sizeAfter = getStoreSize()
    assert.ok(
      sizeAfter <= 40_001,
      `store size after sweep should be ≤ EVICT_TARGET, got ${sizeAfter}`,
    )
    assert.ok(
      sizeAfter >= 39_000,
      `store should retain most recent entries, got ${sizeAfter}`,
    )
  })
})
