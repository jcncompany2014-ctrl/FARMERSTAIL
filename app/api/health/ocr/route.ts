import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { parseMedicalRecord } from '@/lib/vision/parseMedicalRecord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/health/ocr — 진료 영수증 / 처방전 이미지 OCR.
 *
 * 입력
 *   { imageDataUrl: "data:image/...;base64,...", dogId?: uuid }
 *
 * 출력 (200)
 *   { ok: true, data: MedicalRecordExtract }
 *
 * 출력 (4xx/5xx)
 *   { code, message }
 *
 * # 안전
 * - 인증 필수. IP 기반 rate limit 5/min.
 * - 이미지 size 5MB 제한 (base64 6.7MB → server 처리 한도).
 * - **결과를 DB 에 자동 저장 안 함**. 호출처가 사용자 확인 후 별도
 *   endpoint (예: /api/health/records POST) 로 반영.
 */

const zOcr = z.object({
  imageDataUrl: z
    .string()
    .min(20)
    // base64 + data url 길이 상한 — 5MB 이미지 ≈ 6.7M 문자
    .max(7_500_000),
  dogId: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'health-ocr',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해주세요' },
      { status: 429 },
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

  const parsed = await parseRequest(req, zOcr)
  if (!parsed.ok) return parsed.response
  const { imageDataUrl } = parsed.data

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

  const result = await parseMedicalRecord(imageDataUrl, apiKey)
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, data: result.data })
}
