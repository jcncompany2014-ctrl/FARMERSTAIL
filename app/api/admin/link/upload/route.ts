import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dbError } from '@/lib/api/errors'
import { requireAdmin } from '../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /link 콘텐츠 이미지 업로드 — 기존 event-images 버킷(공개 읽기·관리자 쓰기
 * 정책)의 `link/{kind}/` 접두 경로. 버킷 신설 없이 같은 정책·같은 8MB 한도를 쓴다
 * (products/events 업로드 라우트와 동일 패턴 — 한도는 버킷 설정과 같아야 한다).
 */
const BUCKET = 'event-images'
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const KINDS = new Set(['cover', 'moment', 'banner'])

function extFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    default:
      return 'bin'
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' }, { status: 400 })
  }
  const file = form.get('file')
  const kind = (form.get('kind') ?? '').toString()
  if (!(file instanceof File)) {
    return NextResponse.json({ code: 'NO_FILE', message: '파일이 없습니다' }, { status: 400 })
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ code: 'BAD_KIND', message: '용도가 올바르지 않아요' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { code: 'UNSUPPORTED_TYPE', message: '지원하지 않는 이미지 형식이에요 (JPG/PNG/WebP/AVIF)' },
      { status: 415 },
    )
  }
  if (file.size === 0) {
    return NextResponse.json({ code: 'EMPTY_FILE', message: '빈 파일이에요' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { code: 'TOO_LARGE', message: `파일이 너무 커요 (최대 ${Math.round(MAX_BYTES / (1024 * 1024))}MB)` },
      { status: 413 },
    )
  }

  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `link/${kind}/${stamp}-${rand}.${extFor(file.type)}`

  // 쿠키 클라이언트 — event-images 의 "admin insert" RLS(is_admin) 가 관문.
  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
    cacheControl: '31536000',
  })
  if (uploadError) return dbError(uploadError, 'admin_link_upload', '업로드에 실패했어요')

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ ok: true, url: pub.publicUrl, path })
}
