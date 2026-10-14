import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
