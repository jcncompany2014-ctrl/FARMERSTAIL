import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Size limit — browsers shouldn't POST multi-MB product shots for a 1200-wide
// PDP, and Vercel Edge/Node routes have implicit body limits anyway. 8 MB is
// a comfortable ceiling for modern JPEG/WebP hero images.
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

  // 1) Admin auth gate.
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

  // 2) Parse multipart. Expect `file` (File) and optional `slug` (for filename
  // prefix — organizes images per product in the bucket).
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

  // 3) Build a safe, collision-resistant path inside the `products` bucket.
  // Prefix with slug (sanitized) so the admin console groups images visually.
  const safeSlug =
    slugRaw.replace(/[^a-z0-9\-_]/gi, '').slice(0, 40) || 'unknown'
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const ext = extFor(file.type)
  const path = `${safeSlug}/${stamp}-${rand}.${ext}`

  // 4) Upload. RLS policy `products_admin_insert` gates on is_admin() — the
  // authed supabase client respects that.
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('products')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      // We pick unique filenames ourselves, so don't let supabase retry with
      // a different name — duplicate means collision, which is a bug.
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

  const { data: pub } = supabase.storage.from('products').getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    url: pub.publicUrl,
    path,
  })
}

/**
 * DELETE — admin 이 ImageUploader 에서 이미지를 "X" 로 제거할 때 호출.
 *
 * 보낼 게 path (bucket-relative) 또는 publicUrl 둘 중 하나. publicUrl 인 경우
 * `/object/public/products/` 마커 뒤가 path. 외부 manual URL (Daum 우편번호
 * 처럼 외부 호스팅된 이미지를 admin 이 직접 입력) 은 marker 가 없어 fall-through
 * 로 무시된다.
 *
 * 왜 별도 핸들러?
 *   업로드 시점엔 path 가 unique (Date.now+random) 이고 cacheControl 1년이라
 *   안전하지만, admin 이 갤러리에서 이미지를 빼면 DB 의 gallery_urls 만 갱신되고
 *   Storage 파일은 고아로 남아 비용이 누적된다. ImageUploader 의 removeImage
 *   가 background fetch 로 이 핸들러를 호출해 고아를 즉시 정리한다.
 *
 *   사용자가 폼을 cancel 해도 파일은 삭제됐다는 trade-off — admin UX 에선 cancel
 *   이 드물고, 만약 실수로 지웠어도 manual URL 입력으로 복구 가능. Storage 비용
 *   누적이 더 큰 위험이라 이쪽을 택한다.
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
    // URL 이 외부 도메인 / 우리 버킷이 아님 → no-op (200 으로 조용히)
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase.storage.from('products').remove([path])
  if (error) {
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

/**
 * publicUrl 또는 raw path 에서 bucket-relative path 를 안전하게 추출.
 * - traversal (`..`) 차단
 * - 절대 경로 (`/foo`) 차단
 * - 우리 버킷 마커가 없으면 null (외부 URL 로 간주, 삭제 시도 안 함)
 */
function resolvePath(
  rawPath?: string,
  rawUrl?: string,
): string | null {
  let candidate: string | null = null
  if (rawPath && typeof rawPath === 'string') {
    candidate = rawPath.trim()
  } else if (rawUrl && typeof rawUrl === 'string') {
    const marker = '/object/public/products/'
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
