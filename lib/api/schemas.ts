/**
 * API route 공용 Zod 스키마.
 *
 * 한 곳에 모아 Zod 의존을 단일화. 라우트별 스키마는 짧은 inline 으로 두고,
 * 여러 곳에서 재사용되는 정규식/제약은 여기서 export.
 *
 * # 가이드라인
 * - **모든 user-input 는 Zod parse 통과해야** API 본 로직에 도달.
 * - parseRequest() helper 가 JSON.parse / Zod 둘 다 잡아 422 로 일관 응답.
 * - 메시지는 한국어 — 사용자에게 노출되는 경우가 있음.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ──────────────────────────────────────────────────────────────────────────
// Common primitives
// ──────────────────────────────────────────────────────────────────────────

/** UUID v4. Supabase 가 모든 PK 로 사용. */
export const zUuid = z.string().uuid('잘못된 ID 형식이에요')

/** 한국 휴대폰 (010 / 011 / 016~19) — 하이픈 허용. */
export const zKrPhone = z
  .string()
  .regex(/^01[016789][- ]?\d{3,4}[- ]?\d{4}$/, '올바른 휴대폰 번호가 아니에요')

/** 5자리 우편번호 */
export const zKrZip = z.string().regex(/^\d{5}$/, '5자리 우편번호를 입력해 주세요')

/** 이메일 — RFC 보다 느슨한 실용 규칙 */
export const zEmail = z.string().email('올바른 이메일이 아니에요')

/** YYYY-MM-DD */
export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않아요')

/** 짧은 자유 텍스트 (배송 메모 등) — XSS 방어는 React 가 알아서. 길이만 제한. */
export const zShortText = z.string().max(200)
export const zMediumText = z.string().max(500)
export const zLongText = z.string().max(2000)

// ──────────────────────────────────────────────────────────────────────────
// Per-endpoint schemas
// ──────────────────────────────────────────────────────────────────────────

export const zAnalysisRequest = z.object({
  analysisId: zUuid,
})

export const zPaymentConfirm = z.object({
  paymentKey: z.string().min(8).max(200),
  orderId: z.string().min(8).max(200),
  amount: z.number().int().positive().max(100_000_000),
})

export const zOrderCancel = z.object({
  reason: zShortText.optional(),
})

/**
 * Web Push 표준 PushSubscriptionJSON 형식.
 * pushManager.subscribe().toJSON() 이 반환하는 모양 그대로 받는다.
 */
export const zPushSubscribe = z.object({
  endpoint: z.string().url().max(500),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(200),
  }),
})

export const zPushUnsubscribe = z.object({
  endpoint: z.string().url().max(500),
})

export const zPushPreferences = z.object({
  enabled: z.boolean().optional(),
  marketing_enabled: z.boolean().optional(),
  order_enabled: z.boolean().optional(),
  delivery_enabled: z.boolean().optional(),
  reminder_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_start_hour: z.number().int().min(0).max(23).optional(),
  quiet_end_hour: z.number().int().min(0).max(23).optional(),
})

export const zRestockRequest = z.object({
  productId: zUuid,
  variantId: zUuid.optional().nullable(),
})

export const zNewsletterSubscribe = z.object({
  email: zEmail,
  source: z.string().max(40).optional(),
})

export const zAccountDelete = z.object({
  confirmText: z.literal('탈퇴'),
  reason: zShortText.optional(),
})

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Request body 를 JSON.parse + Zod parse 하는 헬퍼.
 *
 * 성공: { ok: true, data: T }
 * 실패: { ok: false, response: NextResponse } — 호출 측에서 그대로 return.
 *
 * 422 (validation 실패) / 400 (JSON 파싱 실패) 를 분리해 운영 모니터링이 둘을
 * 구분할 수 있게.
 */
export async function parseRequest<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse }
> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않아요' },
        { status: 400 },
      ),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    // 첫 번째 오류만 message 로 노출 — 나머지는 details 로 디버그.
    const first = result.error.issues[0]
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 'VALIDATION_FAILED',
          message: first?.message ?? '입력값이 올바르지 않아요',
          details: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 },
      ),
    }
  }

  return { ok: true, data: result.data }
}
