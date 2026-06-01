import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { parseMedicalRecord } from '@/lib/vision/parseMedicalRecord'
import {
  checkAnthropicDailyCap,
  recordAnthropicUsage,
} from '@/lib/anthropic-usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROUTE = 'health-ocr'

/**
 * POST /api/health/ocr — 진료 영수증 / 처방전 이미지 OCR.
 *
 * # 입력 (audit #95)
 * multipart/form-data
 *   image: Blob (JPEG/PNG/WebP, ≤5MB — 클라이언트 다운스케일 후)
 *   dogId?: uuid (옵셔널, 기록 연관 강아지)
 *
 * # 출력 (200)
 *   { ok: true, data: MedicalRecordExtract }
 *
 * # 출력 (4xx/5xx)
 *   { code, message }
 *
 * # 안전
 * - 인증 필수. IP 기반 rate limit 5/min.
 * - 이미지 size 5MB 제한.
 * - **결과를 DB 에 자동 저장 안 함**. 호출처가 사용자 확인 후 별도
 *   endpoint (예: /api/health/records POST) 로 반영.
 */

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_BYTES = 5 * 1024 * 1024

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'health-ocr',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429 },
    )
  }

  // 일일 전역 비용 cap 가드 (마스터피스 P1-O4). OCR 은 sonnet vision 이라
  // 호출당 단가가 높음 — cap 보호가 특히 중요. fail-open.
  const cap = await checkAnthropicDailyCap(ROUTE)
  if (cap.exceeded) {
    return NextResponse.json(
      {
        code: 'DAILY_CAP_EXCEEDED',
        message: '오늘 AI 사용량이 많아 잠시 후 다시 시도해 주세요',
      },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // audit #95: multipart 파싱 (이전엔 5MB base64 JSON → 메모리 spike).
  let imageBlob: Blob | null = null
  let dogId: string | null = null
  try {
    const form = await req.formData()
    const value = form.get('image')
    if (value instanceof Blob) imageBlob = value
    const dogIdRaw = form.get('dogId')
    if (typeof dogIdRaw === 'string' && UUID_RE.test(dogIdRaw)) {
      dogId = dogIdRaw
    }
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
  if (imageBlob.size > MAX_BYTES) {
    return NextResponse.json(
      { code: 'TOO_LARGE', message: '5MB 이하 이미지만 올릴 수 있어요' },
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
  // dogId 는 현재 호출처에서 사용 안 함 (audit/추후 확장용 슬롯).
  void dogId

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        code: 'NOT_CONFIGURED',
        message: 'OCR 기능이 아직 설정되지 않았어요',
      },
      { status: 503 },
    )
  }

  // parseMedicalRecord 는 data URL 형식을 받음 — Blob → base64 변환.
  // 서버 메모리에서 1회 발생 — 클라이언트와 다르게 OOM 위험 낮음.
  const buffer = Buffer.from(await imageBlob.arrayBuffer())
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

  const result = await parseMedicalRecord(dataUrl, apiKey)
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: 502 },
    )
  }

  // 사용량 누적 (best-effort, fail-open — 응답 막지 않음).
  await recordAnthropicUsage(ROUTE, result.usage)

  return NextResponse.json({ ok: true, data: result.data })
}
