import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { purgeDogStorage } from '@/lib/storage/purgeUserStorage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/dogs/{id}/purge-photos — 지운 강아지의 사진 파기 (2026-09-26 출시 전 점검 5차).
 *
 * 강아지 삭제는 화면이 DB 행을 지우는 것으로 끝나서 일기·체크인·진료기록·프로필 사진이
 * 탈퇴할 때까지 남았다(처리방침 "파기"와 어긋남). 삭제가 **성공한 뒤** 화면이 부른다.
 *
 * 안전장치: 그 강아지가 아직 있으면 지우지 않는다(삭제가 실패했는데 사진만 사라지면 안 된다).
 * 지우는 범위는 본인 폴더 `{uid}/{dogId}…` 뿐이라 남의 파일은 건드릴 수 없다.
 */
export async function POST(_req: Request, { params }: Params) {
  const { id: dogId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dogId)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '잘못된 요청이에요' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: still, error: stillErr } = await admin
    .from('dogs')
    .select('id')
    .eq('id', dogId)
    .maybeSingle()
  if (stillErr) {
    return NextResponse.json({ code: 'LOOKUP_FAILED', message: '잠시 후 다시 시도해 주세요' }, { status: 503 })
  }
  if (still) {
    return NextResponse.json({ code: 'DOG_EXISTS', message: '아직 있는 강아지예요' }, { status: 409 })
  }

  const results = await purgeDogStorage(admin as never, user.id, dogId)
  const failed = results.filter((r) => r.error)
  if (failed.length > 0) {
    captureBusinessEvent('error', 'dog.delete.storage_partial_failure', {
      userId: user.id,
      dogId,
      failed: failed.map((r) => `${r.bucket}:${r.error}`).join(' | '),
    })
  }
  return NextResponse.json({
    ok: failed.length === 0,
    removed: results.reduce((s, r) => s + r.removed, 0),
  })
}
