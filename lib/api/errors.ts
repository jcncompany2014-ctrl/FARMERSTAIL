/**
 * API error response helper (audit #69).
 *
 * 이전: 다수 라우트가 `{ message: error.message }` 식으로 PostgreSQL/PostgREST
 * 원본 에러를 client 에 그대로 노출 → 스키마/제약 이름/컬럼 reconnaissance.
 *
 * # 정책
 *  - client 에는 generic 한국어 메시지 + 안정적인 code 만.
 *  - 원본 message 는 server 콘솔 / Sentry 로만.
 *  - 호출처는 `dbError()` 또는 `internalError()` 사용.
 *
 * # 사용
 *   import { dbError } from '@/lib/api/errors'
 *   const { error } = await supabase.from('...').insert(...)
 *   if (error) return dbError(error, 'order_create')
 *
 * # 보안 트레이드오프
 * 개발 환경 (NODE_ENV !== production) 에서는 디버깅 편의 위해 원본 메시지
 * 그대로 노출 — production 만 mask.
 *
 * # 테스트
 * next/server import 라 node:test 단위 테스트 어려움 → Playwright e2e
 * (tests/e2e/*) 로 통합 검증. dev/prod 메시지 차이는 수동 검증.
 */
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  buildErrorBody,
  extractMessage,
  type ApiErrorCode,
  type ErrLike,
} from './errors-body.ts'

// Re-export — 호출처 호환성 유지 (`import { ApiErrorCode } from '@/lib/api/errors'`)
export { buildErrorBody, extractMessage }
export type { ApiErrorCode, ErrLike }

/**
 * DB / PostgREST 에러 → 일반 메시지. 원본은 Sentry 로.
 *
 * @param err Supabase response.error 또는 catch block 의 unknown
 * @param context 'order_create' 같은 비즈니스 도메인 라벨 (Sentry tag)
 * @param userMessage 사용자에게 보여줄 한국어 메시지 (default: generic)
 * @param status HTTP status (default 500)
 */
export function dbError(
  err: ErrLike,
  context: string,
  userMessage = '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요',
  status = 500,
): NextResponse {
  const originalMessage = extractMessage(err)
  // Sentry — 원본 보존.
  Sentry.captureException(new Error(`[api.${context}] ${originalMessage}`), {
    tags: { 'api.context': context, 'api.error_type': 'db' },
  })

  const body = buildErrorBody({
    code: 'DB_ERROR',
    userMessage,
    originalMessage,
    isDev: process.env.NODE_ENV !== 'production',
  })
  return NextResponse.json(body, { status })
}

/**
 * 외부 API (Toss, Anthropic, Resend) 실패 — 원본 보존 + 일반 메시지.
 */
export function externalError(
  err: ErrLike,
  context: string,
  userMessage = '외부 서비스에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요',
  status = 502,
): NextResponse {
  const originalMessage = extractMessage(err)
  Sentry.captureException(new Error(`[api.${context}] ${originalMessage}`), {
    tags: { 'api.context': context, 'api.error_type': 'external' },
  })
  const body = buildErrorBody({
    code: 'EXTERNAL_FAIL',
    userMessage,
    originalMessage,
    isDev: process.env.NODE_ENV !== 'production',
  })
  return NextResponse.json(body, { status })
}

/**
 * 내부 unhandled — try/catch fallback.
 */
export function internalError(
  err: unknown,
  context: string,
  userMessage = '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요',
  status = 500,
): NextResponse {
  const originalMessage =
    err instanceof Error ? err.message : String(err ?? 'unknown')
  Sentry.captureException(
    err instanceof Error ? err : new Error(`[api.${context}] ${originalMessage}`),
    { tags: { 'api.context': context, 'api.error_type': 'internal' } },
  )
  const body = buildErrorBody({
    code: 'INTERNAL',
    userMessage,
    originalMessage,
    isDev: process.env.NODE_ENV !== 'production',
  })
  return NextResponse.json(body, { status })
}
