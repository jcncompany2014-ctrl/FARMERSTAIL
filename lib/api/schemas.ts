/**
 * API route 공용 Zod 스키마 — pure (Next.js / Node 의존 없음).
 *
 * 한 곳에 모아 Zod 의존을 단일화. 라우트별 스키마는 짧은 inline 으로 두고,
 * 여러 곳에서 재사용되는 정규식/제약은 여기서 export.
 *
 * # 가이드라인
 * - **모든 user-input 는 Zod parse 통과해야** API 본 로직에 도달.
 * - parseRequest() helper (lib/api/parseRequest.ts) 가 JSON.parse / Zod
 *   둘 다 잡아 422 로 일관 응답.
 * - 메시지는 한국어 — 사용자에게 노출되는 경우가 있음.
 *
 * # 분리 이유
 * 이 파일은 Node test runner 에서 직접 import 가능해야 하므로 next/server
 * 등 런타임 의존을 두지 않는다. parseRequest 는 NextResponse 가 필요해
 * lib/api/parseRequest.ts 로 옮겨졌다 — 호출처는 양쪽 모두 import.
 */
import { z } from 'zod'

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

/**
 * Capacitor 네이티브 푸시 토큰 등록.
 * platform: 'ios' (APNs) | 'android' (FCM).
 * token: APNs hex 문자열 또는 FCM token string.
 * device_id: 같은 디바이스가 토큰 갱신 시 row 재사용을 위한 안정적 식별자.
 */
export const zNativePushRegister = z.object({
  platform: z.enum(['ios', 'android']),
  token: z.string().min(8).max(500),
  deviceId: z.string().min(4).max(200),
  appVersion: z.string().max(40).optional(),
  osVersion: z.string().max(40).optional(),
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

/** /api/personalization/compute 입력 — 강아지 ID 만 필요. 라우트가 최신 설문 +
 * 분석 row 조회 → decideFirstBox → dog_formulas upsert. */
export const zPersonalizationCompute = z.object({
  dogId: zUuid,
})

/** /api/personalization/checkin — 매 cycle 의 week_2 / week_4 응답 저장.
 * 모든 점수는 선택 (응답 안 한 항목은 null). */
export const zPersonalizationCheckin = z.object({
  dogId: zUuid,
  cycleNumber: z.number().int().min(1).max(120),
  checkpoint: z.enum(['week_2', 'week_4']),
  stoolScore: z.number().int().min(1).max(7).nullable().optional(),
  coatScore: z.number().int().min(1).max(5).nullable().optional(),
  appetiteScore: z.number().int().min(1).max(5).nullable().optional(),
  overallSatisfaction: z.number().int().min(1).max(5).nullable().optional(),
  freeText: z.string().max(2000).optional(),
  // Storage path 형식 (`{user_id}/{dog_id}/{filename}`) 허용. signed URL 은
  // 만료되고 bucket private 라 public URL 불가 — path 만 저장.
  photoUrls: z.array(z.string().min(1).max(500)).max(8).optional(),
})

/** /api/personalization/adjust — 사용자가 추천 비율을 직접 수정. 합 1.0 검증
 * 은 라우트가 한 번 더. blocked (알레르기) 라인은 0% 만 허용. */
export const zPersonalizationAdjust = z.object({
  dogId: zUuid,
  cycleNumber: z.number().int().min(1).max(120),
  lineRatios: z.object({
    basic: z.number().min(0).max(1),
    weight: z.number().min(0).max(1),
    skin: z.number().min(0).max(1),
    premium: z.number().min(0).max(1),
    joint: z.number().min(0).max(1),
  }),
  toppers: z
    .object({
      protein: z.number().min(0).max(0.3),
      vegetable: z.number().min(0).max(0.3),
    })
    .optional(),
})

// parseRequest helper 는 lib/api/parseRequest.ts 로 분리 (NextResponse 의존).
// 호출처는 보통 두 모듈 모두 import — schemas + parseRequest.
