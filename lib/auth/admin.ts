/**
 * Admin authorization helpers.
 *
 * # 배경
 *
 * Supabase의 `auth.users`에는 두 개의 metadata 필드가 있다:
 *   - `raw_user_meta_data` → JS SDK에서 `user.user_metadata`로 노출.
 *     **anon 키로 로그인한 본인이 자기 값을 쓸 수 있음.**
 *     (`supabase.auth.updateUser({ data: { role: 'admin' } })` 한 줄)
 *   - `raw_app_meta_data` → `user.app_metadata`. service_role 키로만 쓰기 가능.
 *     서버/DB 바깥에서는 못 건드림.
 *
 * 그래서 **admin 판정은 반드시 `app_metadata.role`을 봐야 한다.**
 * 과거에는 `user_metadata.role`을 봤었는데 이건 self-elevation이 가능한 필드라
 * 사실상 권한 체크가 없는 것과 같았다. `20260423000000_admin_role_to_app_metadata.sql`
 * 마이그레이션이 기존 데이터를 옮기고, 이 헬퍼가 새 체크 경로의 단일 진입점이다.
 *
 * # 단일 권위: app_metadata.role (R101-C)
 *
 * admin 판정은 `app_metadata.role === 'admin'` **단일 소스**다. service_role로만
 * 쓸 수 있고 anon 키로 못 바꾸며(self-elevation 불가), DB `is_admin()` +
 * `prevent_profile_role_change` 트리거가 같은 기준을 강제한다.
 *
 * 과거엔 `profiles.role === 'admin'` 2차 fallback이 있었으나(둘 중 하나면 admin),
 * DB `is_admin()`(20260515000001)이 fallback을 제거하면서 코드와 어긋났다.
 * R101-C에서 코드도 app_metadata SSOT로 통일 — 프로덕션 admin은 둘 다 설정돼 있어
 * 회수 영향 0 (2026-05-31 실측). profiles.role은 표시/조회용으로만 남는다.
 *
 * # 사용법
 *
 *   // Server Component / Route Handler:
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   if (!user || !(await isAdmin(supabase, user))) { ...403/redirect }
 *
 *   // 또는 가드 한 줄:
 *   const user = await requireAdmin(supabase) // throws on failure
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * JWT에 박혀 있는 app_metadata.role만 본다. 동기 체크 — DB 라운드트립 없음.
 * 대부분의 핫패스(요청당 여러 번 부르는 경우)는 이걸 먼저 쓰고, 필요할 때만
 * {@link isAdmin}의 fallback을 탄다.
 */
export function isAdminByJwt(user: User | null | undefined): boolean {
  if (!user) return false
  const appRole = (user.app_metadata as { role?: string } | null | undefined)
    ?.role
  return appRole === 'admin'
}

/**
 * JWT + profiles 이중 경로 admin 체크. JWT로 확정되면 DB는 안 건드림.
 *
 * 반환값은 `boolean`. 실패 이유가 필요하면 직접 {@link isAdminByJwt}와 DB 조회를
 * 조합해서 쓰자. 대부분의 호출자는 admin인지 아닌지만 알면 된다.
 */
export async function isAdmin(
  _supabase: SupabaseClient,
  user: User | null | undefined
): Promise<boolean> {
  // R101-C: app_metadata.role 단일 소스. profiles.role 2차 fallback 제거 —
  // DB is_admin()와 일치(SSOT). supabase 인자는 호출처 시그니처 호환 위해 유지.
  return Promise.resolve(isAdminByJwt(user))
}

/**
 * 가드 헬퍼. admin이면 user를 반환, 아니면 {@link AdminAuthError}를 throw.
 *
 * Route handler에서는 try/catch로 401/403 응답을 내거나, 혹은 이걸 쓰기보다
 * 직접 `isAdmin`으로 체크하고 `NextResponse.json({...}, { status: 403 })`을
 * 리턴하는 게 에러 메시지/코드 커스터마이즈에 유리하다. 가드 스타일은
 * Server Component에서 redirect와 함께 쓸 때 유용.
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new AdminAuthError('UNAUTHORIZED', '로그인이 필요합니다')
  }
  if (!(await isAdmin(supabase, user))) {
    throw new AdminAuthError('FORBIDDEN', '관리자 권한이 필요합니다')
  }
  return user
}

export type AdminAuthReason = 'UNAUTHORIZED' | 'FORBIDDEN'

export class AdminAuthError extends Error {
  readonly reason: AdminAuthReason
  constructor(reason: AdminAuthReason, message: string) {
    super(message)
    this.reason = reason
    this.name = 'AdminAuthError'
  }
}
