import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
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
 * # 보안
 *  - token unique + expires_at + uploaded_photo_url IS NULL 조건 RPC 검증
 *  - 파일 크기 3MB, mime 화이트리스트
 *  - storage path: photo-requests/{token}.{ext} — 토큰이 path 라 추측 어려움
 */

type Params = { params: Promise<{ token: string }> }

const zUpload = z.object({
  // data url base64 (앱 측에서 변환)
  imageDataUrl: z.string().min(20).max(7_500_000),
})

function extFromMime(mime: string): string {
  return (
    { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] ??
    'jpg'
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

  const parsed = await parseRequest(req, zUpload)
  if (!parsed.ok) return parsed.response
  const { imageDataUrl } = parsed.data

  // data url → buffer + mime
  const m = /^data:([^;]+);base64,(.*)$/.exec(imageDataUrl)
  if (!m) {
    return NextResponse.json(
      { code: 'INVALID_IMAGE', message: '이미지 형식이 올바르지 않아요' },
      { status: 400 },
    )
  }
  const mime = m[1]
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimes.includes(mime)) {
    return NextResponse.json(
      { code: 'INVALID_MIME', message: 'JPG/PNG/WebP 만 지원해요' },
      { status: 400 },
    )
  }
  const buffer = Buffer.from(m[2], 'base64')
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { code: 'TOO_LARGE', message: '3MB 이하만 업로드 가능해요' },
      { status: 400 },
    )
  }

  // service_role storage 업로드 (익명 사용자가 직접 storage 접근 X)
  const admin = createAdminClient()
  const ext = extFromMime(mime)
  const path = `photo-requests/${token}.${ext}`
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
