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
 * # 이중 경로 (defense in depth)
 *
 * 1. 1차: `user.app_metadata.role === 'admin'` — JWT에서 즉시 읽음, DB 라운드트립 없음.
 * 2. 2차(fallback): `profiles.role === 'admin'` — DB 조회.
 *
 * 둘 다 성공해야 admin으로 인정되는 건 아니고, **둘 중 하나만 true면 admin**이다.
 * 이유: 마이그레이션 중간에 한쪽만 업데이트됐거나, 새 admin을 app_metadata에만 부여하고
 * profiles 동기화를 깜빡한 운영 상태에서도 정상 동작하게 하기 위함. 한쪽을 단일 소스로
 * 강제하면 operational gap이 곧바로 장애가 된다.
 *
 * 우선순위가 app_metadata인 이유: 빠르고(JWT), anon 키로 못 바꾸고, service_role로만
 * 부여 가능 → 신뢰할 수 있는 1순위. profiles는 app DB라 RLS bug로 뚫릴 수 있음 →
 * 보조 경로.
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
  supabase: SupabaseClient,
  user: User | null | undefined
): Promise<boolean> {
  if (!user) return false
  if (isAdminByJwt(user)) return true

  // fallback: profiles.role 조회. RLS 하에 본인 row만 읽히면 충분 — profiles
  // self-select policy를 전제로 한다.
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    // 조회 자체가 실패한 경우, fail closed — admin 아님으로 처리.
    // 이 경로는 JWT가 admin이 아닐 때만 도는 fallback이라 false를 내도
    // 정상 admin에게 피해 없음 (JWT에 role 박혀 있는 한).
    return false
  }
  return data?.role === 'admin'
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
  constructor(
    readonly reason: AdminAuthReason,
    message: string
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}
