import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Blog covers are hero images at ~1200w; we keep the same 8MB ceiling as
// product images since the two share uploader ergonomics.
const MAX_BYTES = 8 * 1024 * 1024
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
        message: '지원하지 않는 이미지 형식이에요',
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

  const safeSlug =
    slugRaw.replace(/[^a-z0-9\-_]/gi, '').slice(0, 40) || 'post'
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const ext = extFor(file.type)
  const path = `${safeSlug}/${stamp}-${rand}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('blog-covers')
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
    .from('blog-covers')
    .getPublicUrl(path)

  return NextResponse.json({ ok: true, url: pub.publicUrl, path })
}

/**
 * DELETE — blog cover 가 교체되거나 인라인 이미지가 본문에서 빠질 때 호출해
 * Storage 고아를 정리. 우리 버킷이 아닌 외부 URL 은 no-op. 자세한 정책은
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

  const { error } = await supabase.storage.from('blog-covers').remove([path])
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
    const marker = '/object/public/blog-covers/'
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
