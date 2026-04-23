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
