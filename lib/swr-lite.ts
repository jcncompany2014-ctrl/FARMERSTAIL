/**
 * SWR-lite — react-query 없이 가벼운 dedup + cache + revalidation (audit #103).
 *
 * react-query (~25KB gzipped) 도입 **거절** — 이 50줄 헬퍼로 흔한 needs 충족:
 *   - 같은 key 동시 호출 dedup (Map<key, Promise>)
 *   - staleTime 동안 cache 재사용
 *   - 'ft:cache:invalidate' window event 로 강제 무효화
 *   - visibilitychange 시 자동 revalidate (선택)
 *
 * # 결정 근거 (2026-05-16)
 * - 솔로 창업자 단계 → 25KB 추가 의존성은 부담
 * - 본 앱은 RSC 전환 진행 중 — 서버 fetch 가 70% 이상 처리 (audit #101)
 * - useQuery 의 mutation/optimistic update 필요 surface 거의 없음
 *   (대부분 server form submission)
 * - 필요 시점에 마이그: SWR-lite 호출처를 useQuery 로 변경
 *   현재 호출처: 없음 (RSC 가 dedup 대체). 기능 보존용 lib 만 유지.
 *
 * # 사용
 *   const cache = createSwrCache()
 *
 *   // 서버 컴포넌트 / route handler 에서
 *   const dogs = await cache.fetch('dogs:' + userId, () =>
 *     supabase.from('dogs').select('id').eq('user_id', userId)
 *   )
 *
 *   // 데이터 변경 시
 *   cache.invalidate('cart:' + userId)
 */

export interface SwrCacheOptions {
  /** stale time (ms) — 이 시간 내엔 cache 재사용 (default 30s). */
  staleTime?: number
  /** 최대 캐시 entry 수 — LRU eviction (default 100). */
  maxEntries?: number
}

interface CacheEntry<T> {
  value: T
  ts: number
}

export interface SwrCache {
  /**
   * key 로 fetch — 동시 호출은 dedup, staleTime 내 cache hit 재사용.
   */
  fetch<T>(key: string, fn: () => Promise<T>, staleMs?: number): Promise<T>
  /** 특정 key 강제 무효화. */
  invalidate(key: string): void
  /** prefix 로 일괄 무효화 — 'cart:*' 같은 패턴. */
  invalidatePrefix(prefix: string): void
  /** 캐시 전체 비움. */
  clear(): void
}

export function createSwrCache(opts: SwrCacheOptions = {}): SwrCache {
  const staleDefault = opts.staleTime ?? 30_000
  const maxEntries = opts.maxEntries ?? 100
  const cache = new Map<string, CacheEntry<unknown>>()
  const inFlight = new Map<string, Promise<unknown>>()

  function evictIfNeeded() {
    if (cache.size <= maxEntries) return
    // 가장 오래된 entry 삭제 (Map insertion order).
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }

  return {
    async fetch<T>(
      key: string,
      fn: () => Promise<T>,
      staleMs: number = staleDefault,
    ): Promise<T> {
      const now = Date.now()
      const cached = cache.get(key) as CacheEntry<T> | undefined
      if (cached && now - cached.ts < staleMs) {
        return cached.value
      }
      const existing = inFlight.get(key) as Promise<T> | undefined
      if (existing) return existing

      const p = (async () => {
        try {
          const value = await fn()
          cache.set(key, { value, ts: Date.now() })
          evictIfNeeded()
          return value
        } finally {
          inFlight.delete(key)
        }
      })()
      inFlight.set(key, p)
      return p
    },
    invalidate(key: string) {
      cache.delete(key)
      inFlight.delete(key)
    },
    invalidatePrefix(prefix: string) {
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key)
      }
    },
    clear() {
      cache.clear()
      inFlight.clear()
    },
  }
}

/**
 * Window-scoped singleton — module 단계에서 만들면 SSR/Edge 에서도 모듈 호이스팅
 * 으로 공유. 단 server 와 client 가 분리된 메모리라 cache 도 분리됨 (의도).
 */
let _client: SwrCache | null = null
export function getClientSwrCache(): SwrCache {
  if (typeof window === 'undefined') return createSwrCache()
  if (!_client) _client = createSwrCache()
  return _client
}
