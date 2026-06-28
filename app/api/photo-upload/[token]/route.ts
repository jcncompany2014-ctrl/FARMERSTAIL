import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOG_AVATARS_BUCKET, MAX_PHOTO_BYTES } from '@/lib/dogPhotos'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

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
  // audit 1-5: 익명 endpoint 라 IP 기반 rate limit. 한 IP 가 짧은 시간에
  // 같은(or 다른) 토큰으로 마구 업로드해 storage 를 비싸게 만들 수 없도록
  // 분당 6회 / 시간당 30회 로 제한. token+IP 복합 key.
  const { token } = await params
  const rlMin = rateLimit({
    bucket: 'photo-upload:min',
    key: `${ipFromRequest(req)}|${token}`,
    limit: 6,
    windowMs: 60_000,
  })
  if (!rlMin.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rlMin.headers },
    )
  }
  const rlHour = rateLimit({
    bucket: 'photo-upload:hour',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60 * 60_000,
  })
  if (!rlHour.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rlHour.headers },
    )
  }

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
  // audit 2-10: upsert=true 였음 → 같은 토큰 보유자가 N번 덮어쓰기 가능.
  // submit_photo_request RPC 가 uploaded_photo_url IS NULL 조건으로 1회만
  // dog.photo_url 을 갱신하긴 하지만, storage 비용/난입 차단을 위해 첫
  // 업로드만 받는 정책으로 변경. 중복은 409 로 명확히 응답.
  const { error: upErr } = await admin.storage
    .from(DOG_AVATARS_BUCKET)
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime,
    })
  if (upErr && /already exists|Duplicate/i.test(upErr.message)) {
    return NextResponse.json(
      {
        code: 'ALREADY_UPLOADED',
        message: '이미 업로드된 사진이에요. 친구에게 새 링크를 부탁해 보세요.',
      },
      { status: 409 },
    )
  }
  if (upErr) {
    // audit #69: 원본 storage message 클라이언트 노출 제거 — 서버 로그만(2026-06-20).
    console.error('[photo-upload] storage error:', upErr.message)
    return NextResponse.json(
      { code: 'UPLOAD_FAILED', message: '사진 업로드에 실패했어요' },
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
