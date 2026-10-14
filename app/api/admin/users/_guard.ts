import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'

/**
 * /api/admin/users/[id]/* 공통 관리자 관문 — 다른 어드민 라우트와 같은 판정(getUser + isAdmin, note·message 라우트와 동일).
 * 통과하면 로그인 사용자와 쿠키 클라이언트(작업 기록 recordAdminAction 용), 아니면 401/403 응답.
 * 쓰기는 각 라우트가 이 관문을 지난 뒤 service_role 로, 범위는 `.eq('user_id', 경로의 id)` 로 코드가 책임진다(규칙8).
 */
export async function requireAdminUser(): Promise<
  | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 }) }
  }
  if (!(await isAdmin(supabase, user))) {
    return { ok: false, response: NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 }) }
  }
  return { ok: true, user, supabase }
}

/**
 * 탈퇴한 회원이면 409 로 막는다 (2026-10-15 F-b, 규칙275). 익명화한 계정(profiles.deleted_at)에 주소·전화·메모·알레르기·메시지를
 * 다시 써 넣지 않게 — 예전엔 '프로필이 있는가'만 봐서 탈퇴 계정에 이름·전화가 든 기본 배송지를 새로 만들 수 있었다.
 * 없는 고객은 404, 조회 실패는 500(모르면 쓰지 않는다 — 규칙1). 통과하면 null.
 * 호출은 관리자 확인(requireAdminUser) 뒤, service_role 클라이언트로(profiles 는 관리자 쿠키로도 읽히지만 범위를 코드가 묶는다).
 */
export async function rejectDeletedCustomer(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<NextResponse | null> {
  const { data, error } = await admin.from('profiles').select('id, deleted_at').eq('id', userId).maybeSingle()
  if (error) return NextResponse.json({ code: 'DB_ERROR', message: '고객을 확인하지 못했어요' }, { status: 500 })
  if (!data) return NextResponse.json({ code: 'NOT_FOUND', message: '고객을 찾지 못했어요' }, { status: 404 })
  if (data.deleted_at) {
    return NextResponse.json(
      { code: 'DELETED_CUSTOMER', message: '탈퇴한 회원이에요 — 고치거나 기록할 수 없어요' },
      { status: 409 },
    )
  }
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
