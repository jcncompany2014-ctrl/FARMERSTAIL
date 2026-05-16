import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSwrCache } from './swr-lite.ts'

describe('swr-lite (audit #103)', () => {
  it('dedup 동일 key 동시 호출', async () => {
    const cache = createSwrCache()
    let calls = 0
    const fn = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 5))
      return calls
    }
    const [a, b, c] = await Promise.all([
      cache.fetch('k', fn),
      cache.fetch('k', fn),
      cache.fetch('k', fn),
    ])
    // 3 동시 호출 — fn 은 1번만 실행, 모두 같은 결과.
    assert.equal(calls, 1)
    assert.equal(a, 1)
    assert.equal(b, 1)
    assert.equal(c, 1)
  })

  it('staleTime 내 cache 재사용', async () => {
    const cache = createSwrCache({ staleTime: 1000 })
    let calls = 0
    const fn = async () => {
      calls += 1
      return calls
    }
    const a = await cache.fetch('k', fn)
    const b = await cache.fetch('k', fn)
    assert.equal(a, 1)
    assert.equal(b, 1)
    assert.equal(calls, 1)
  })

  it('invalidate 후 재호출', async () => {
    const cache = createSwrCache()
    let calls = 0
    const fn = async () => ++calls
    await cache.fetch('k', fn)
    cache.invalidate('k')
    await cache.fetch('k', fn)
    assert.equal(calls, 2)
  })

  it('invalidatePrefix 패턴 무효화', async () => {
    const cache = createSwrCache()
    let cartCalls = 0
    let userCalls = 0
    await cache.fetch('cart:1', async () => ++cartCalls)
    await cache.fetch('cart:2', async () => ++cartCalls)
    await cache.fetch('user:1', async () => ++userCalls)
    cache.invalidatePrefix('cart:')
    await cache.fetch('cart:1', async () => ++cartCalls)
    await cache.fetch('user:1', async () => ++userCalls)
    assert.equal(cartCalls, 3) // 1, 2, 1 재호출
    assert.equal(userCalls, 1) // user: prefix 영향 X
  })

  it('LRU eviction (maxEntries)', async () => {
    const cache = createSwrCache({ maxEntries: 2 })
    let calls = 0
    const fn = (k: string) => async () => {
      calls += 1
      return `${k}:${calls}`
    }
    await cache.fetch('a', fn('a'))
    await cache.fetch('b', fn('b'))
    await cache.fetch('c', fn('c')) // a evict
    // a 다시 호출 → fn 재실행
    const aResult = await cache.fetch('a', fn('a'))
    assert.match(aResult, /^a:/)
  })
})
