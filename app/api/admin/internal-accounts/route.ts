import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { loadInternalUserIds } from '@/lib/admin/internal-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 내부 계정(사장님·시험 계정) id 목록 — 브라우저에서 그리는 어드민 목록(정기배송 등)이 시험 계정을 기본으로 숨기는 데 쓴다
 * (2026-10-24 규칙313). admin_user_ids 는 service_role 전용이라 여기서 대신 부른다. 못 받으면 ok:false — 화면은 '시험 계정을
 * 못 가렸어요'를 띄운다(조용히 섞인 목록을 맞는 목록처럼 보이지 않는다, 규칙1).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  if (!(await isAdmin(supabase, user))) return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })

  const internal = await loadInternalUserIds(createAdminClient())
  return NextResponse.json({ ok: internal.ok, ids: [...internal.ids] })
}
