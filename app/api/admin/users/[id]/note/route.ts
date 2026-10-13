import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/[id]/note — 고객에 대한 사장님 운영 메모 저장.
 *
 * # 왜 라우트로 옮겼나 (2026-07-31)
 * 예전엔 어드민 화면이 **쿠키 클라이언트로 직접** `profiles.admin_note` 를
 * 썼다. 그런데 `profiles` 는 28개 칸이 전부 authenticated 에게 열려 있었고
 * (실측), RLS 는 본인 행 UPDATE 를 허용한다 — 즉 **고객이 자기 admin_note 를
 * 직접 쓸 수 있었다.** 사장님이 그 고객에 대해 적어 둔 메모(전화 상담 내용·
 * 주의사항)를 당사자가 지우거나 위조할 수 있다는 뜻이다.
 *
 * `profiles` 컬럼 권한을 화이트리스트로 잠그면서(20260731000100) admin_note 는
 * 고객 권한에서 빠졌다. 그래서 이 쓰기는 서버에서 관리자 검증 후
 * service_role 로 한다 — 잠금과 호출부를 같이 옮기는 것(규칙13).
 *
 * # 2026-10-13 — 저장 위치를 admin_user_notes 로 옮겼다(규칙197)
 * 쓰기는 막혔지만 **읽기**가 남아 있었다 — 고객은 자기 profiles 행을 읽을 수 있어 메모가 보였다.
 * 새 표는 고객이 읽지도 쓰지도 못한다(마이그 20261013100100). 옛 칸은 20261013100200 이 지운다.
 */

const zNote = z.object({ note: z.string().max(2000).nullable() })
const zUserId = z.string().uuid()

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!zUserId.safeParse(id).success) {
    return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 })
  }

  const parsed = await parseRequest(req, zNote)
  if (!parsed.ok) return parsed.response

  // ★메모는 관리자만 읽는 표(admin_user_notes)에 둔다(2026-10-13 규칙197). profiles 는 고객이 자기 행을
  //   읽을 수 있어서 profiles.admin_note 에 적은 상담 메모가 고객에게 보였다. 비우면 행을 지운다.
  const note = parsed.data.note?.trim() || null
  const admin = createAdminClient()
  const { error } = note
    ? await admin
        .from('admin_user_notes')
        .upsert({ user_id: id, note, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'user_id' })
    : await admin.from('admin_user_notes').delete().eq('user_id', id)

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: '메모 저장에 실패했어요' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
