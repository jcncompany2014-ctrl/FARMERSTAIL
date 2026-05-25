/**
 * Photo URL cache (R15-B19).
 *
 * Supabase storage signed URL 은 만료 시간 있음 (기본 1시간).
 * 매번 새로 발급하면 latency 도 ↑, 사용자 quota 도 빠르게 소진.
 *
 * 전략:
 *   - sessionStorage (메모리 / 새 탭마다 reset) 에 path → { url, expires_at }
 *   - 같은 path 요청 시 expires_at - 5min 이전이면 cache 재사용
 *   - 5min 안 남으면 새로 발급
 *
 * # 사용
 *
 *   const url = await getCachedSignedUrl(supabase, 'dog-photos/.../foo.jpg')
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

interface CacheEntry {
  url: string
  expiresAt: number // epoch ms
}

const CACHE_KEY_PREFIX = 'ft:signedUrl:'
// 1시간 - 5분 safety margin
const DEFAULT_TTL_SEC = 3600
const SAFETY_MARGIN_MS = 5 * 60 * 1000

function readCache(path: string): CacheEntry | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + path)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    return parsed
  } catch {
    return null
  }
}

function writeCache(path: string, entry: CacheEntry): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + path, JSON.stringify(entry))
  } catch {
    /* quota / private mode 등 — 무시 */
  }
}

/**
 * @param bucket Storage bucket name. 기본 'dog-photos'.
 * @param path bucket 안의 path.
 * @param ttlSec signed URL 유효시간. 기본 3600 (1h).
 */
export async function getCachedSignedUrl(
  supabase: AnyClient,
  path: string,
  bucket: string = 'dog-photos',
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<string | null> {
  if (!path) return null

  const cacheKey = `${bucket}/${path}`
  const now = Date.now()
  const cached = readCache(cacheKey)
  if (cached && cached.expiresAt - SAFETY_MARGIN_MS > now) {
    return cached.url
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSec)
  if (error || !data?.signedUrl) {
    return null
  }
  writeCache(cacheKey, {
    url: data.signedUrl,
    expiresAt: now + ttlSec * 1000,
  })
  return data.signedUrl
}

/**
 * 여러 path 를 한 번에 — 병렬 fetch + 캐시.
 */
export async function getCachedSignedUrls(
  supabase: AnyClient,
  paths: string[],
  bucket: string = 'dog-photos',
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<Array<string | null>> {
  return Promise.all(
    paths.map((p) => getCachedSignedUrl(supabase, p, bucket, ttlSec)),
  )
}

/**
 * cache 강제 무효화 — 사진 삭제 / 교체 시.
 */
export function invalidateSignedUrl(
  path: string,
  bucket: string = 'dog-photos',
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${bucket}/${path}`)
  } catch {
    /* noop */
  }
}
