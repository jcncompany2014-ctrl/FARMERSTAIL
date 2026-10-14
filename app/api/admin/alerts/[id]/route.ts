import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { recordAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/alerts/[id] — 경보함의 경보 하나를 '처리함'으로 닫는다(메모 함께) (2026-10-14 어드민 B1, 규칙248).
 *
 * admin_alerts 는 관리자도 쿠키로는 읽기만 된다(쓰기 정책 없음, 마이그 20261014210000). 그래서 관리자 확인 뒤 service_role 로
 * 쓴다 — 다른 어드민 쓰기 라우트(users/[id]/note)와 같은 방식. 이미 처리된 경보는 다시 닫지 않는다(409 — 두 번 눌러 메모가
 * 덮이지 않게). 같은 일이 다시 생기면 경보 기록이 새 줄을 만든다.
 */

const zBody = z.object({ note: z.string().trim().max(1000).optional().nullable() })
const zId = z.string().uuid()

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!zId.safeParse(id).success) {
    return NextResponse.json({ code: 'INVALID_ID', message: '경보를 찾을 수 없어요' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })
  }

  const parsed = await parseRequest(req, zBody)
  if (!parsed.ok) return parsed.response
  const note = parsed.data.note?.trim() || null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id, resolved_note: note })
    .eq('id', id)
    .is('resolved_at', null)
    .select('id, kind')
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '처리 표시를 저장하지 못했어요 — 다시 시도해 주세요' }, { status: 500 })
  }
  // 0행 = 없는 경보이거나 이미 처리됨 — '저장됨'으로 말하지 않는다(규칙1).
  if (!data || data.length === 0) {
    const { data: row, error: rowErr } = await admin.from('admin_alerts').select('id, resolved_at').eq('id', id).maybeSingle()
    if (rowErr) {
      return NextResponse.json({ code: 'DB_ERROR', message: '경보 상태를 확인하지 못했어요 — 새로고침해 주세요' }, { status: 500 })
    }
    if (!row) return NextResponse.json({ code: 'NOT_FOUND', message: '경보를 찾을 수 없어요' }, { status: 404 })
    return NextResponse.json({ code: 'ALREADY_RESOLVED', message: '이미 처리된 경보예요 — 새로고침해 주세요' }, { status: 409 })
  }

  await recordAdminAction(supabase, {
    action: 'admin_alert_resolve',
    entityType: 'system',
    entityId: id,
    diff: { kind: data[0]!.kind, note: note ? note.slice(0, 200) : null },
    req,
  })
  return NextResponse.json({ ok: true })
}
