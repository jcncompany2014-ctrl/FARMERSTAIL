import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOG_AVATARS_BUCKET, MAX_PHOTO_BYTES } from '@/lib/dogPhotos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/photo-upload/[token] — 익명 친구 사진 업로드.
 *
 * 인증 없이 토큰만으로 업로드 가능. fetch_photo_request 로 토큰 검증 후
 * service_role 로 storage 업로드 → submit_photo_request RPC 로 dog.photo_url
 * 자동 적용.
 *
 * # 입력 (audit #95)
 * multipart/form-data
 *   image: Blob (JPEG/PNG/WebP, ≤3MB — 클라이언트에서 다운스케일 후 전송)
 *
 * # 보안
 *  - token unique + expires_at + uploaded_photo_url IS NULL 조건 RPC 검증
 *  - 파일 크기 3MB, mime 화이트리스트
 *  - storage path: photo-requests/{token}.{ext} — 토큰이 path 라 추측 어려움
 */

type Params = { params: Promise<{ token: string }> }

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

function extFromMime(mime: string): string {
  return (
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }[mime] ?? 'jpg'
  )
}

export async function POST(req: Request, { params }: Params) {
  const { token } = await params

  // 토큰 검증 — anon supabase client 가 RPC 호출
  const supabase = await createClient()
  const { data: check } = await supabase.rpc('fetch_photo_request', {
    p_token: token,
  })
  type CheckRow = { ok: boolean; message?: string; error?: string }
  const checkRow = (check ?? null) as CheckRow | null
  if (!checkRow || !checkRow.ok) {
    return NextResponse.json(
      {
        code: checkRow?.error ?? 'INVALID',
        message: checkRow?.message ?? '유효하지 않은 링크예요',
      },
      { status: 400 },
    )
  }

  // multipart 파싱 — formData() 가 Next.js Edge/Node 모두 지원.
  // audit #95: 이전엔 base64 dataUrl 을 JSON 으로 받았으나 (5MB → 6.7MB 메모리),
  // 이제 Blob 을 직접 받아 메모리 spike + payload 크기 절감.
  let imageBlob: Blob | null = null
  try {
    const form = await req.formData()
    const value = form.get('image')
    if (value instanceof Blob) imageBlob = value
  } catch {
    return NextResponse.json(
      { code: 'INVALID_FORM', message: '요청 형식이 올바르지 않아요' },
      { status: 400 },
    )
  }
  if (!imageBlob) {
    return NextResponse.json(
      { code: 'MISSING_IMAGE', message: '이미지가 없어요' },
      { status: 400 },
    )
  }
  if (imageBlob.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { code: 'TOO_LARGE', message: '3MB 이하만 업로드 가능해요' },
      { status: 400 },
    )
  }
  const mime = imageBlob.type
  if (!ALLOWED_MIMES.includes(mime as (typeof ALLOWED_MIMES)[number])) {
    return NextResponse.json(
      { code: 'INVALID_MIME', message: 'JPG/PNG/WebP 만 지원해요' },
      { status: 400 },
    )
  }

  // service_role storage 업로드 (익명 사용자가 직접 storage 접근 X)
  const admin = createAdminClient()
  const ext = extFromMime(mime)
  const path = `photo-requests/${token}.${ext}`
  const buffer = Buffer.from(await imageBlob.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(DOG_AVATARS_BUCKET)
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: mime,
    })
  if (upErr) {
    return NextResponse.json(
      { code: 'UPLOAD_FAILED', message: upErr.message },
      { status: 500 },
    )
  }
  const { data: publicUrl } = admin.storage
    .from(DOG_AVATARS_BUCKET)
    .getPublicUrl(path)

  const { data: result } = await admin.rpc('submit_photo_request', {
    p_token: token,
    p_photo_url: publicUrl.publicUrl,
  })
  type ResRow = { ok: boolean; message?: string; dogId?: string }
  const resRow = (result ?? null) as ResRow | null
  if (!resRow || !resRow.ok) {
    return NextResponse.json(
      { code: 'RPC_FAIL', message: resRow?.message ?? '저장에 실패했어요' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
