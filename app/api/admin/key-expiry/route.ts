import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { recordAdminAction } from '@/lib/admin-audit'
import { EXTERNAL_KEY_NAMES, expiryFromSetOn, isExternalKeyName } from '@/lib/admin/key-expiry'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PUT /api/admin/key-expiry — 외부 키의 설정일(새로 받은 날)을 적는다 (2026-10-14 어드민 B4, 규칙252).
 *
 * 만료일 = 설정일 + 키 수명(배송조회 21일 · 인스타 60일, lib/admin/key-expiry 정본). 만료일을 직접 알면 expiresOn 으로 덮는다
 * (예: 메타 콘솔에 보이는 날짜). **키 값은 받지도 저장하지도 않는다** — 날짜만.
 * 관리자 확인 뒤 service_role 로 쓴다(admin_key_expiry 는 쿠키로는 읽기만, 마이그 20261014210100).
 */

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const zBody = z.object({
  keyName: z.enum(EXTERNAL_KEY_NAMES as [string, ...string[]]),
  setOn: ISO,
  expiresOn: ISO.optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export async function PUT(req: Request) {
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
  const { keyName, setOn } = parsed.data
  if (!isExternalKeyName(keyName)) {
    return NextResponse.json({ code: 'INVALID_KEY', message: '모르는 키예요' }, { status: 400 })
  }
  // 앞날짜·너무 옛날 날짜는 오입력이다(오늘 기준 1년 전 ~ 오늘).
  const today = todayKstIsoDate()
  if (setOn > today || setOn < addDaysKst(today, -365)) {
    return NextResponse.json({ code: 'INVALID_DATE', message: '설정일은 오늘이나 그 전 날짜로 적어 주세요' }, { status: 400 })
  }
  const expiresOn = parsed.data.expiresOn || expiryFromSetOn(keyName, setOn)
  if (!expiresOn || expiresOn < setOn) {
    return NextResponse.json({ code: 'INVALID_DATE', message: '만료일은 설정일 뒤여야 해요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('admin_key_expiry').upsert(
    {
      key_name: keyName,
      set_on: setOn,
      expires_on: expiresOn,
      note: parsed.data.note?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: 'key_name' },
  )
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '저장하지 못했어요 — 다시 시도해 주세요' }, { status: 500 })
  }

  await recordAdminAction(supabase, {
    action: 'admin_key_expiry_set',
    entityType: 'system',
    entityId: keyName,
    diff: { setOn, expiresOn },
    req,
  })
  return NextResponse.json({ ok: true, keyName, setOn, expiresOn })
}
