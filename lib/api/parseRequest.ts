/**
 * parseRequest — Request body 를 JSON.parse + Zod parse 하는 헬퍼.
 *
 * 분리 이유: NextResponse 의존이 있어 lib/api/schemas.ts 와 분리하면
 * schemas.ts 가 Node test runner 에서 직접 import 가능 (next/server 미존재
 * 환경). 호출처는 보통 두 파일 다 import.
 *
 * 성공: { ok: true, data: T }
 * 실패: { ok: false, response: NextResponse } — 호출 측에서 그대로 return.
 *
 * 422 (validation 실패) / 400 (JSON 파싱 실패) 를 분리해 운영 모니터링이 둘을
 * 구분할 수 있게.
 */
import { NextResponse } from 'next/server'
import type { z } from 'zod'

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
