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
 */

const zNote = z.object({ note: z.string().max(2000).nullable() })

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
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

  const { error } = await createAdminClient()
    .from('profiles')
    .update({ admin_note: parsed.data.note?.trim() || null })
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: '메모 저장에 실패했어요' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
