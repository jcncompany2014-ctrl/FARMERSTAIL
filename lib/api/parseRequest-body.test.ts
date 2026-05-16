import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  buildInvalidJsonBody,
  buildValidationFailedBody,
} from './parseRequest-body.ts'

/**
 * parseRequest.ts 의 pure body 빌더 단위 테스트.
 *
 * 본체는 NextResponse import 라 node:test 에서 모듈 해석 실패 — 정책 자체
 * (INVALID_BODY 메시지, VALIDATION_FAILED 형식) 는 pure 분리해서 여기서 검증.
 */

describe('buildInvalidJsonBody', () => {
  it('code = INVALID_BODY', () => {
    const body = buildInvalidJsonBody()
    assert.equal(body.code, 'INVALID_BODY')
  })

  it('한국어 message 노출', () => {
    const body = buildInvalidJsonBody()
    assert.match(body.message, /형식|올바르지/)
  })

  it('details 필드 없음 (JSON 파싱 자체 실패라 상세 X)', () => {
    const body = buildInvalidJsonBody()
    assert.equal(body.details, undefined)
  })
})

describe('buildValidationFailedBody', () => {
  it('code = VALIDATION_FAILED', () => {
    const schema = z.object({ name: z.string().min(3) })
    const result = schema.safeParse({ name: 'a' })
    assert.equal(result.success, false)
    if (!result.success) {
      const body = buildValidationFailedBody(result.error)
      assert.equal(body.code, 'VALIDATION_FAILED')
    }
  })

  it('첫 issue 의 message 가 사용자용 message', () => {
    const schema = z.object({
      name: z.string().min(3, '이름은 3글자 이상이어야 해요'),
    })
    const result = schema.safeParse({ name: 'a' })
    if (!result.success) {
      const body = buildValidationFailedBody(result.error)
      assert.equal(body.message, '이름은 3글자 이상이어야 해요')
    }
  })

  it('multiple issues — details 에 모두 포함, path dot-join', () => {
    const schema = z.object({
      name: z.string().min(3),
      profile: z.object({
        age: z.number().min(0),
      }),
    })
    const result = schema.safeParse({ name: 'a', profile: { age: -1 } })
    if (!result.success) {
      const body = buildValidationFailedBody(result.error)
      assert.ok(body.details)
      assert.equal(body.details.length, 2)
      // nested path 가 'profile.age' 로 dot-join 되는지
      const paths = body.details.map((d) => d.path)
      assert.ok(paths.includes('name'))
      assert.ok(paths.includes('profile.age'))
    }
  })

  it('빈 issues 배열 시 default message (방어)', () => {
    // 실제로 발생 어려운 케이스지만 first?.message ?? fallback 가드 검증.
    const fakeError = { issues: [] } as unknown as z.ZodError
    const body = buildValidationFailedBody(fakeError)
    assert.equal(body.code, 'VALIDATION_FAILED')
    assert.match(body.message, /올바르지|입력값/)
    assert.deepEqual(body.details, [])
  })

  it('보안: 원본 zod issue 의 input/expected 같은 메타는 노출 X (path + message 만)', () => {
    const schema = z.object({ password: z.string().min(8) })
    const result = schema.safeParse({ password: '123' })
    if (!result.success) {
      const body = buildValidationFailedBody(result.error)
      const json = JSON.stringify(body)
      // input value 자체 ('123') 가 details 에 누설되면 안 됨
      assert.ok(!json.includes('"input"'))
      assert.ok(!json.includes('"received"'))
    }
  })
})
