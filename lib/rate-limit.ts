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
 * # Edge-safe
 *
 * - globalThis에 Map 하나만 둠. setInterval 같은 persistent timer 없음
 *   (Edge에서 안 됨). GC는 hit할 때 만료 엔트리 덮어쓰는 식으로 자연스럽게 일어남.
 *   unique IP가 폭증해도 60초 윈도우 끝나면 해당 IP는 한 엔트리(overwrite).
 *   long-tail attack이면 수만 IP × 수 KB = 수 MB. Edge instance RAM으로 감당됨.
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
  const cf = h.get('cf-connecting-ip')
  if (cf) return cf
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = h.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
