/**
 * errors-body.ts — API error 정책의 pure 부분 (next/server / Sentry 의존성 없음).
 *
 * errors.ts 본체가 NextResponse + Sentry 를 import 해서 node:test 단위 테스트가
 * 모듈 해석 실패. 정책 자체 (dev/prod 메시지 mask) 만 분리해서 직접 검증 가능.
 *
 * audit #69 — DB/PostgREST 원본 메시지 client 노출 차단 정책의 SSOT.
 */

export type ApiErrorCode =
  | 'DB_ERROR'
  | 'INTERNAL'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_FAIL'

export type ErrLike =
  | { message?: string; code?: string; details?: string }
  | Error
  | null
  | undefined

/** ErrLike → 메시지 문자열. Sentry 라벨 + dev _debug 필드용 (pure). */
export function extractMessage(err: ErrLike): string {
  if (!err) return 'unknown'
  if (err instanceof Error) return err.message
  return err.message ?? 'unknown'
}

/**
 * pure: API error response body 빌더.
 *
 * NextResponse 의존성 없이 dev/prod 메시지 정책만 캡슐화 — node:test 로
 * 직접 단위 테스트 가능. 호출처 (dbError 등) 가 이 결과를 NextResponse.json
 * 으로 감싼다.
 *
 * 정책:
 *  - prod: { code, message } 만. 원본은 Sentry.
 *  - dev: { code, message, _debug } — 디버깅용 원본 노출.
 */
export function buildErrorBody(opts: {
  code: ApiErrorCode
  userMessage: string
  originalMessage: string
  isDev: boolean
}): { code: ApiErrorCode; message: string; _debug?: string } {
  const { code, userMessage, originalMessage, isDev } = opts
  if (isDev) {
    return { code, message: userMessage, _debug: originalMessage }
  }
  return { code, message: userMessage }
}
