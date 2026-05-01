/**
 * Feature flags / A/B 테스트.
 *
 * # 데이터 모델
 * feature_flags 테이블 행:
 *   { key, enabled, variants[], default_variant }
 *
 * # 사용
 * server-side (RSC):
 *   import { resolveFlag } from '@/lib/featureFlags'
 *   const flag = await resolveFlag('hero_copy_test', userId)
 *   if (flag.enabled && flag.variant === 'urgency') { ... }
 *
 * client-side (use client):
 *   const flag = useFeatureFlag('hero_copy_test')   // hook (동일 결정 로직)
 *
 * # 결정 로직
 * 1. enabled=false → { enabled:false, variant:default_variant, payload:null }
 * 2. variants 없음 → boolean flag → { enabled:true, variant:default_variant }
 * 3. user 있음 → hash(userId, key) % 100 → cumulative weight 비교 → variant
 * 4. user 없음 → default_variant
 *
 * # 캐싱
 * server: Next "use cache" + 60s revalidate (flag 변경이 즉시 반영되되 DB
 * 라운드트립은 1분에 1번).
 * client: in-memory module Map (페이지 lifecycle 동안 일관).
 */

export type RawFlagRow = {
  key: string
  enabled: boolean
  variants: Array<{
    key: string
    weight: number
    payload?: unknown
  }>
  default_variant: string
}

export type ResolvedFlag = {
  enabled: boolean
  variant: string
  payload: unknown
}

// ──────────────────────────────────────────────────────────────────────────
// Hash — 같은 (userId, flagKey) 조합엔 항상 같은 0~99 정수.
// FNV-1a 해시. 외부 lib 필요 없음.
// 테스트가 직접 호출할 수 있게 export — 내부 호출자도 그대로 사용.
// ──────────────────────────────────────────────────────────────────────────
export function hashBucket(userId: string, key: string): number {
  const s = `${userId}:${key}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 100
}

// ──────────────────────────────────────────────────────────────────────────
// Variant 결정.
// 테스트용으로 export — DB 레이어 없이 결정 로직만 단위 테스트 가능.
// ──────────────────────────────────────────────────────────────────────────
export function pickVariant(
  flag: RawFlagRow,
  userId: string | null,
): ResolvedFlag {
  if (!flag.enabled) {
    return {
      enabled: false,
      variant: flag.default_variant,
      payload: defaultPayload(flag),
    }
  }
  if (!flag.variants || flag.variants.length === 0) {
    return { enabled: true, variant: flag.default_variant, payload: null }
  }
  if (!userId) {
    return {
      enabled: true,
      variant: flag.default_variant,
      payload: defaultPayload(flag),
    }
  }
  const bucket = hashBucket(userId, flag.key)
  const totalWeight = flag.variants.reduce((s, v) => s + (v.weight ?? 0), 0)
  if (totalWeight === 0) {
    return {
      enabled: true,
      variant: flag.default_variant,
      payload: defaultPayload(flag),
    }
  }
  // weight 합계가 100 아니면 비례 정규화.
  let cumulative = 0
  for (const v of flag.variants) {
    cumulative += ((v.weight ?? 0) / totalWeight) * 100
    if (bucket < cumulative) {
      return {
        enabled: true,
        variant: v.key,
        payload: v.payload ?? null,
      }
    }
  }
  // 부동소수점 끝자락 — 마지막 variant fallback.
  const last = flag.variants[flag.variants.length - 1]
  return {
    enabled: true,
    variant: last.key,
    payload: last.payload ?? null,
  }
}

function defaultPayload(flag: RawFlagRow): unknown {
  const v = flag.variants.find((x) => x.key === flag.default_variant)
  return v?.payload ?? null
}

// ──────────────────────────────────────────────────────────────────────────
// Server resolver.
// ──────────────────────────────────────────────────────────────────────────

let serverCache: { rows: RawFlagRow[]; expiresAt: number } | null = null
const TTL_MS = 60 * 1000

/**
 * 서버사이드 flag 평가. RSC / Route Handler 에서 호출.
 *
 * @param userId - 인증된 사용자 id 또는 null. 비로그인 = default_variant.
 */
export async function resolveFlag(
  key: string,
  userId: string | null,
): Promise<ResolvedFlag> {
  const flag = await fetchFlag(key)
  if (!flag) {
    return { enabled: false, variant: 'control', payload: null }
  }
  return pickVariant(flag, userId)
}

async function fetchFlag(key: string): Promise<RawFlagRow | null> {
  const all = await fetchAllFlags()
  return all.find((f) => f.key === key) ?? null
}

async function fetchAllFlags(): Promise<RawFlagRow[]> {
  const now = Date.now()
  if (serverCache && serverCache.expiresAt > now) {
    return serverCache.rows
  }
  // dynamic import 로 supabase server client — module cycle 방지.
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase
    .from('feature_flags')
    .select('key, enabled, variants, default_variant')
  const rows = (data ?? []) as RawFlagRow[]
  serverCache = { rows, expiresAt: now + TTL_MS }
  return rows
}

/**
 * 운영자가 admin 에서 flag 변경한 직후 캐시 즉시 무효화. 서버 메모리
 * 캐시라 인스턴스마다 60s 안에 자연 만료. /admin/feature-flags 의 폼이
 * 저장 후 이 헬퍼 호출하면 즉시 반영.
 */
export function invalidateFlagCache(): void {
  serverCache = null
}
