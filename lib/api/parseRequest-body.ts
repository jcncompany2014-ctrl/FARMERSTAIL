/**
 * parseRequest-body.ts — parseRequest 의 pure body 빌더.
 *
 * NextResponse 의존성 없이 정책 (INVALID_BODY 메시지, VALIDATION_FAILED 메시지
 * + details 형식) 만 캡슐화 → node:test 단위 테스트 가능. parseRequest.ts 본체가
 * 이 결과를 NextResponse.json 으로 감싼다.
 *
 * errors-body.ts 와 동일한 분리 패턴.
 */
import type { z } from 'zod'

export type ApiErrorDetails = Array<{ path: string; message: string }>

export type ApiErrorBody = {
  code: 'INVALID_BODY' | 'VALIDATION_FAILED'
  message: string
  details?: ApiErrorDetails
}

/** JSON.parse 실패 시 body — 400. */
export function buildInvalidJsonBody(): ApiErrorBody {
  return {
    code: 'INVALID_BODY',
    message: '요청 형식이 올바르지 않아요',
  }
}

/**
 * Zod safeParse 실패 시 body — 422.
 *
 * 첫 issue 의 message 를 일반 사용자용 message 로, 전체 issues 를
 * details 에 path + message 만 추려서 노출. path 가 nested 면 dot-join.
 */
export function buildValidationFailedBody(error: z.ZodError): ApiErrorBody {
  const first = error.issues[0]
  return {
    code: 'VALIDATION_FAILED',
    message: first?.message ?? '입력값이 올바르지 않아요',
    details: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  }
}
