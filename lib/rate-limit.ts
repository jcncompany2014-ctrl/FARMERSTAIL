/**
 * 초간단 in-memory fixed-window rate limiter.
 *
 * # 왜 이걸로 시작하나
 *
 * - Upstash Redis / Supabase row 기반 rate limit도 고려했지만, 현재 구성에
 *   Redis가 없고 매 요청마다 DB 한 번 더 때리는 비용도 싫음. Vercel Edge는
 *   isolate 단위로 Map이 살아있으니 단일 인스턴스 기준 효과적이고, 인스턴스가
 *   N개면 실질 한도는 quota × N이 된다. **이게 문제가 될 만큼 트래픽이 올라가면
 *   그때 외부 스토어로 교체**, 그 전까진 "없는 것보다 훨씬 낫다"가 맞다.
 *
 * - 알고리즘은 fixed-window counter. sliding window가 더 공정하지만 구현/메모리
 *   비용 대비 이득이 작고, abuse 방어용이지 billing용이 아니어서 window 전환
 *   경계 burst(2x 버스트) 정도는 수용 가능.
 *
 * # 사용법
 *
 *   const r = rateLimit({ bucket: 'login', key: ip, limit: 5, windowMs: 60_000 })
 *   if (!r.ok) {
 *     return new Response('Too Many Requests', { status: 429, headers: r.headers })
 *   }
 *
 * # Edge-safe + 메모리 가드
 *
 * - globalThis에 Map 하나만 둠. setInterval 같은 persistent timer 없음
 *   (Edge에서 안 됨).
 *
 * - 자연 GC: 같은 key 가 다시 들어와 윈도우가 만료됐으면 entry 를 덮어씀. 그러나
 *   "1번만 호출하고 사라지는 IP" 가 누적되면 Map 이 무한 성장 — 분산 attacker
 *   가 IP 별로 1회씩만 보내도 long-tail leak 가능. Vercel Edge isolate 메모리
 *   는 128MB 라 IP × ~80B = 1.6M entries 면 한도 도달.
 *
 * - 가드: `MAX_ENTRIES` 초과 시 1회 sweep — 만료된 entry 제거, 그래도 초과면
 *   가장 오래된 (insertion-order) 일정 비율을 evict. JS Map 의 iteration 순서가
 *   삽입순이라 LRU 근사가 자연스럽게 가능. sweep 비용은 set() 의 O(n) 1회로,
 *   threshold 한참 위까지 가지 않게 buffer 확보.
 */

type Entry = {
  /** 현재 윈도우의 hit count */
  count: number
  /** 윈도우 종료 시각 (epoch ms). 지나면 count 리셋. */
  reset: number
}

// 모듈 레벨 Map은 HMR 리로드 시 새로 만들어질 수 있으므로 globalThis에 고정.
// 개발 중 hot reload 때문에 한도가 풀려 테스트가 꼬이는 것 방지.
const GLOBAL_KEY = '__farmerstail_rl__' as const
type GlobalBucket = Map<string, Entry>
const g = globalThis as unknown as { [GLOBAL_KEY]?: GlobalBucket }
const store: GlobalBucket = g[GLOBAL_KEY] ?? (g[GLOBAL_KEY] = new Map())

// 메모리 가드 — Edge isolate 128MB 의 ~5% 한도 (50K entries × 80B ≈ 4MB).
// HIGH_WATER 도달 시 1회 sweep, EVICT_TARGET 까지 줄임. attacker 가 IP 분산
// 으로 1회 hit 만 만들어도 sweep 이 만료된 entry + 가장 오래된 entry 부터
// 제거하므로 정상 트래픽엔 거의 영향 없음.
const MAX_ENTRIES = 50_000
const EVICT_TARGET = 40_000

function maybeSweep(now: number) {
  if (store.size < MAX_ENTRIES) return
  // 1차: 만료된 entry 제거.
  for (const [k, v] of store) {
    if (v.reset <= now) store.delete(k)
    if (store.size <= EVICT_TARGET) return
  }
  // 2차: 그래도 초과면 가장 오래된 entry 부터 evict (Map iteration = 삽입순).
  for (const k of store.keys()) {
    if (store.size <= EVICT_TARGET) return
    store.delete(k)
  }
}

export type RateLimitArgs = {
  /** 버킷 이름. 정책 단위 — 'login', 'payment', 'admin-upload' 같이 분리. */
  bucket: string
  /** 주체 식별자. 보통 IP, 인증 사용자면 `${userId}` 붙여도 됨. */
  key: string
  /** 허용 횟수 */
  limit: number
  /** 윈도우 길이 (ms) */
  windowMs: number
}

export type RateLimitResult = {
  /** true면 통과, false면 초과. */
  ok: boolean
  /** 윈도우 내 남은 횟수 (0 이상) */
  remaining: number
  /** 윈도우 리셋까지 남은 초 */
  retryAfter: number
  /** 응답에 붙일 표준 헤더 세트 */
  headers: Headers
}

/**
 * 동기 API. Edge에서 await 없이 쓸 수 있도록. 백엔드를 Redis로 바꾸게 되면
 * 그때 async 시그니처로 갈아끼우는 걸 감안해서 호출부는 항상 `await rateLimit(...)`로
 * 써두는 걸 권장(현재 반환값은 Promise 아니지만 await해도 동일).
 */
export function rateLimit(args: RateLimitArgs): RateLimitResult {
  const { bucket, key, limit, windowMs } = args
  const now = Date.now()
  const mapKey = `${bucket}:${key}`
  const existing = store.get(mapKey)

  let entry: Entry
  if (!existing || existing.reset <= now) {
    // 새 윈도우. set() 직전에 가드 — Map 크기가 한도 근처면 sweep.
    maybeSweep(now)
    entry = { count: 1, reset: now + windowMs }
    store.set(mapKey, entry)
  } else {
    existing.count += 1
    entry = existing
  }

  const remaining = Math.max(0, limit - entry.count)
  const retryAfter = Math.max(0, Math.ceil((entry.reset - now) / 1000))
  const ok = entry.count <= limit

  const headers = new Headers({
    // IETF draft RateLimit 헤더. Vercel/Cloudflare도 같은 형식.
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(remaining),
    'RateLimit-Reset': String(retryAfter),
  })
  if (!ok) {
    // 429일 때만 Retry-After. 정상 통과 응답에 붙이면 CDN이 오해할 수 있음.
    headers.set('Retry-After', String(retryAfter))
  }

  return { ok, remaining, retryAfter, headers }
}

/**
 * 요청에서 rate-limit key로 쓸 IP를 뽑는다. Vercel은 `x-forwarded-for`의
 * 가장 왼쪽이 최초 요청자. Cloudflare는 `cf-connecting-ip`. 로컬에선 `x-real-ip`.
 *
 * 주의: 신뢰할 수 없는 proxy 뒤에선 `x-forwarded-for`를 위조할 수 있음.
 * Vercel은 자기네 edge가 이 헤더를 덮어쓰니 프로덕션에선 신뢰 가능. 개발 환경은
 * 공격 걱정 없음.
 */
export function ipFromRequest(req: Request): string {
  const h = req.headers
  // 점검 low: cf-connecting-ip 를 먼저 신뢰하면 Cloudflare 뒤가 아닌 Vercel 환경
  // 에선 클라이언트가 이 헤더를 위조해 레이트리밋 버킷 키를 회피할 수 있다.
  // Vercel edge 는 x-forwarded-for 를 덮어써(leftmost=실 클라이언트) 위조 불가
  // 이므로 이를 우선 신뢰하고, cf-connecting-ip 는 Cloudflare 사용 시 대비 fallback.
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const cf = h.get('cf-connecting-ip')
  if (cf) return cf
  const real = h.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

// ──────────────────────────────────────────────────────────────────────────
// audit 1-9: DB-backed rate limit (옵션)
// ──────────────────────────────────────────────────────────────────────────
//
// 인-메모리 rateLimit() 은 Vercel isolate 별로 카운터가 분리되므로 실 한도가
// quota × isolate 수가 됨. attacker 가 부하를 주거나 isolate cold-start 가
// 잦으면 차단이 약해짐. 정밀 한도가 필요한 엔드포인트(결제 confirm,
// 회원가입 등)는 본 함수를 호출.
//
// 정책 (in-memory 와 DB 의 합성):
//   1. 먼저 in-memory rateLimit() 로 1차 거름 — 같은 isolate 안의 burst 차단.
//   2. 1차 통과 시에만 DB RPC `incr_rate_limit_counter` 호출 — 전역 카운트
//      증가. 한도 초과면 차단.
//
// 비용: DB 호출 1회 (~1-2ms). burst trafic 의 99% 는 in-memory 에서 차단되니
// DB hit 는 정상 통과 트래픽만 발생 → 무시할 만한 수준.

import type { SupabaseClient } from '@supabase/supabase-js'

export type RateLimitDBArgs = RateLimitArgs & {
  supabase: SupabaseClient
}

/**
 * DB-backed rate limit. in-memory 1차 + DB 2차 검사.
 */
export async function rateLimitDB(
  args: RateLimitDBArgs,
): Promise<RateLimitResult> {
  const { supabase, bucket, key, limit, windowMs } = args
  // 1차: in-memory.
  const local = rateLimit({ bucket, key, limit, windowMs })
  if (!local.ok) return local

  // 2차: DB 카운터. window_start_ms = floor(now/windowMs) × windowMs.
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  try {
    const { data, error } = await supabase.rpc('incr_rate_limit_counter', {
      p_bucket: bucket,
      p_key: key,
      p_window_start_ms: windowStart,
    })
    if (error || typeof data !== 'number') {
      // DB 호출 실패 — fail open. local 결과 사용 (이미 ok 였음).
      // 운영 가시성: console.warn 으로 fail-open 발생 사실은 남김. Sentry
      // 직접 import 하면 순환 import 가능성 (rate-limit 이 lib 핵심 모듈) →
      // 호출처가 자체적으로 Sentry breadcrumb 남기게 단순 warn 만.
      console.warn(
        `[rate-limit] DB rpc failed — fail-open. bucket=${bucket} err=${error?.message ?? 'no-data'}`,
      )
      return local
    }
    const count = data as number
    const remaining = Math.max(0, limit - count)
    const retryAfter = Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000))
    const ok = count <= limit
    const headers = new Headers({
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': String(remaining),
      'RateLimit-Reset': String(retryAfter),
    })
    if (!ok) headers.set('Retry-After', String(retryAfter))
    return { ok, remaining, retryAfter, headers }
  } catch {
    return local
  }
}
