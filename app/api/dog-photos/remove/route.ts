import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { DOG_AVATARS_BUCKET, dogAvatarPathFromUrl } from '@/lib/dogPhotos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dog-photos/remove { url } — 강아지 프로필 사진 1장 파기 (2026-09-26 출시 전 점검 5차).
 *
 * # 왜 서버에서
 * 브라우저가 직접 `storage.remove()` 를 부르고 있었는데, 스토리지 삭제는 SELECT 권한도
 * 필요하고 dog-avatars 에는 SELECT 정책이 없다(20260716030000 에서 목록 노출을 막으려
 * 뺐다). 그래서 **0건 삭제로 조용히 끝났고**(`.catch(() => {})`) 바꾸거나 지운 사진이
 * 공개 URL 로 계속 열렸다(실측: 참조 없는 객체 1개). service_role 로 지운다.
 *
 * # 누구 것만
 * 본인 폴더 `{uid}/…` 이거나, 본인 강아지에 쓰인 친구 업로드(옛 경로 `photo-requests/…`)만.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null
  const url = typeof body?.url === 'string' ? body.url : ''
  const path = dogAvatarPathFromUrl(url)
  if (!path || path.includes('..')) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '사진 주소가 올바르지 않아요' }, { status: 400 })
  }

  const admin = createAdminClient()
  let allowed = path.startsWith(`${user.id}/`)
  if (!allowed && path.startsWith('photo-requests/')) {
    // 옛 친구 업로드 경로 — 그 토큰의 강아지가 본인 것인지 확인.
    const { data: tok, error: tokErr } = await admin
      .from('photo_request_tokens')
      .select('dog_id, dogs!inner(user_id)')
      .eq('uploaded_photo_url', url)
      .maybeSingle()
    if (tokErr) {
      return NextResponse.json({ code: 'LOOKUP_FAILED', message: '잠시 후 다시 시도해 주세요' }, { status: 503 })
    }
    const owner = (tok as { dogs?: { user_id?: string } | null } | null)?.dogs?.user_id
    allowed = owner === user.id
  }
  if (!allowed) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '지울 수 없는 사진이에요' }, { status: 403 })
  }

  const { error } = await admin.storage.from(DOG_AVATARS_BUCKET).remove([path])
  if (error) {
    captureBusinessEvent('warning', 'dog_photo.remove_failed', { userId: user.id, dbError: error.message })
    return NextResponse.json({ code: 'REMOVE_FAILED', message: '사진을 지우지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
