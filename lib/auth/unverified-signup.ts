/**
 * 이메일 인증을 안 한 가입 30일 정리 — 대상 판정 순수 함수 (2026-10-13 사장님 결정, 규칙196).
 *
 * 크론 app/api/cron/unverified-signup-purge 가 쓴다. 지우는 건 되돌릴 수 없으므로 판정을 좁게 둔다:
 *  · 이메일로 가입한 계정만(app_metadata.provider === 'email', 다른 로그인 수단 없음) — 카카오·애플은
 *    이메일 인증 칸이 비어 있을 수 있어도 정상 회원이다.
 *  · 이메일 인증 시각이 없다(email_confirmed_at·confirmed_at 둘 다 없음).
 *  · 한 번도 로그인하지 않았다(last_sign_in_at 없음) — 인증 없이는 로그인할 수 없으니 같은 뜻이지만,
 *    '인증 필요' 설정이 꺼진 적이 있으면 실제로 쓰던 계정일 수 있어 한 번 더 막는다.
 *  · 가입한 지 30일이 지났다.
 * 강아지·주문·정기배송이 하나라도 있으면 지우지 않는다 — 그건 크론이 DB 로 확인한다(여기선 계정만 본다).
 *
 * `@/` 값 import 없음 — node 테스트(lib/auth/unverified-signup.test.ts)가 그대로 읽는다.
 */

export const UNVERIFIED_SIGNUP_RETENTION_DAYS = 30

/**
 * 이 시각 **이후에 가입한** 계정만 정리한다 — 사장님 2026-10-14 "이때까지 인증 안 한 사람은 냅두고 앞으로는 제대로".
 * 개인정보처리방침에 이 항목이 들어간 시행일(7일 전 공지, app/legal/privacy EFFECTIVE_DATE)과 같다. 그 전 가입은 영영 대상이 아니다.
 * 그래서 실제로 처음 지울 수 있는 날은 이 시각 + 30일(2026-11-20 무렵)이다.
 */
export const UNVERIFIED_PURGE_APPLIES_FROM = '2026-10-21T00:00:00+09:00'

export type AuthUserLike = {
  id: string
  created_at?: string | null
  email_confirmed_at?: string | null
  confirmed_at?: string | null
  last_sign_in_at?: string | null
  app_metadata?: { provider?: unknown; providers?: unknown } | null
}

export function isUnverifiedPurgeCandidate(u: AuthUserLike, nowMs: number): boolean {
  if (!u.id) return false
  const meta = u.app_metadata ?? {}
  if (meta.provider !== 'email') return false
  const providers = Array.isArray(meta.providers) ? meta.providers : ['email']
  if (providers.some((p) => p !== 'email')) return false
  if (u.email_confirmed_at || u.confirmed_at) return false
  if (u.last_sign_in_at) return false
  const created = u.created_at ? Date.parse(u.created_at) : NaN
  if (!Number.isFinite(created)) return false // 가입 시각을 모르면 지우지 않는다
  if (created < Date.parse(UNVERIFIED_PURGE_APPLIES_FROM)) return false // 방침 시행 전 가입은 그대로 둔다
  return nowMs - created > UNVERIFIED_SIGNUP_RETENTION_DAYS * 24 * 60 * 60 * 1000
}
