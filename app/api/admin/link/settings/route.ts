import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '@/lib/api/errors'
import { isSafeUrl, requireAdmin } from '../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** /link 단일 설정행(커버·하루 사진·스토어 카드) 읽기/쓰기. 쓰기는 service_role. */
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('link_page_settings')
    .select('cover_url, moment_urls, show_store_card, updated_at')
    .eq('id', 1)
    .maybeSingle()
  if (error) return dbError(error, 'admin_link_settings_get', '설정을 불러오지 못했어요')
  return NextResponse.json({ ok: true, settings: data })
}

const MAX_MOMENTS = 12

export async function PUT(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: { cover_url?: unknown; moment_urls?: unknown; show_store_card?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const patch: { cover_url?: string; moment_urls?: string[]; show_store_card?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (body.cover_url !== undefined) {
    if (!isSafeUrl(body.cover_url)) {
      return NextResponse.json({ code: 'BAD_COVER', message: '커버 이미지 주소가 올바르지 않아요' }, { status: 400 })
    }
    patch.cover_url = body.cover_url
  }
  if (body.moment_urls !== undefined) {
    const arr = body.moment_urls
    if (!Array.isArray(arr) || arr.length > MAX_MOMENTS || !arr.every(isSafeUrl)) {
      return NextResponse.json(
        { code: 'BAD_MOMENTS', message: `사진 목록이 올바르지 않아요 (최대 ${MAX_MOMENTS}장)` },
        { status: 400 },
      )
    }
    patch.moment_urls = arr
  }
  if (body.show_store_card !== undefined) {
    if (typeof body.show_store_card !== 'boolean') {
      return NextResponse.json({ code: 'BAD_FLAG', message: '값이 올바르지 않아요' }, { status: 400 })
    }
    patch.show_store_card = body.show_store_card
  }

  const admin = createAdminClient()
  // 규칙1: error 와 0행을 가른다 — 설정행이 없으면(시드 누락) 조용히 성공으로 세지 않는다.
  const { data, error } = await admin.from('link_page_settings').update(patch).eq('id', 1).select('id')
  if (error) return dbError(error, 'admin_link_settings_put', '저장에 실패했어요')
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NO_ROW', message: '설정행이 없어요 — 마이그레이션 시드를 확인해 주세요' }, { status: 409 })
  }
  revalidatePath('/link')
  return NextResponse.json({ ok: true })
}
