import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

/**
 * POST /api/admin/events/upload
 *
 * 이벤트 대표 이미지 업로드. `/api/admin/products/upload` 를 그대로 따라간
 * 패턴 — admin gate + multipart → supabase storage `event-images` 버킷.
 *
 * 버킷 RLS 가 admin 만 쓰기 가능하게 잠가두지만, API 레이어에서 한 번 더
 * 막는 건 방어층 (클라이언트 supabase client 가 혹시라도 다른 JWT 로 붙을
 * 때를 대비).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

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
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()

  // 1) Admin gate.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 }
    )
  }

  // 2) Parse multipart.
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' },
      { status: 400 }
    )
  }

  const file = form.get('file')
  const slugRaw = (form.get('slug') ?? '').toString().trim()

  if (!(file instanceof File)) {
    return NextResponse.json(
      { code: 'NO_FILE', message: '파일이 없습니다' },
      { status: 400 }
    )
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      {
        code: 'UNSUPPORTED_TYPE',
        message: '지원하지 않는 이미지 형식이에요 (JPG/PNG/WebP/AVIF/GIF)',
      },
      { status: 415 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        code: 'TOO_LARGE',
        message: `파일이 너무 커요 (최대 ${Math.round(MAX_BYTES / (1024 * 1024))}MB)`,
      },
      { status: 413 }
    )
  }
  if (file.size === 0) {
    return NextResponse.json(
      { code: 'EMPTY_FILE', message: '빈 파일이에요' },
      { status: 400 }
    )
  }

  // 3) Build path. slug 프리픽스로 버킷 안에서 이벤트별 그룹핑.
  const safeSlug =
    slugRaw.replace(/[^a-z0-9\-_]/gi, '').slice(0, 40) || 'unknown'
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const ext = extFor(file.type)
  const path = `${safeSlug}/${stamp}-${rand}.${ext}`

  // 4) Upload.
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('event-images')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000',
    })

  if (uploadError) {
    return NextResponse.json(
      {
        code: 'UPLOAD_FAILED',
        message: uploadError.message || '업로드에 실패했어요',
      },
      { status: 500 }
    )
  }

  const { data: pub } = supabase.storage
    .from('event-images')
    .getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    url: pub.publicUrl,
    path,
  })
}

/**
 * DELETE — event 이미지가 교체될 때 옛 파일 정리. 정책은
 * /api/admin/products/upload 의 DELETE 주석 참조.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 }
    )
  }

  let body: { path?: string; url?: string }
  try {
    body = (await req.json()) as { path?: string; url?: string }
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' },
      { status: 400 }
    )
  }

  const path = resolvePath(body.path, body.url)
  if (!path) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase.storage.from('event-images').remove([path])
  if (error) {
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

function resolvePath(
  rawPath?: string,
  rawUrl?: string,
): string | null {
  let candidate: string | null = null
  if (rawPath && typeof rawPath === 'string') {
    candidate = rawPath.trim()
  } else if (rawUrl && typeof rawUrl === 'string') {
    const marker = '/object/public/event-images/'
    const idx = rawUrl.indexOf(marker)
    if (idx === -1) return null
    candidate = rawUrl.slice(idx + marker.length)
  }
  if (!candidate) return null
  if (candidate.includes('..')) return null
  if (candidate.startsWith('/')) return null
  if (candidate.length > 256) return null
  return candidate
}
