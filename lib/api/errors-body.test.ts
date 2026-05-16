import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * errors.ts 의 pure helper 만 단위 테스트.
 *
 * 본체 (dbError / externalError / internalError) 는 next/server 의 NextResponse
 * import 때문에 node:test 환경에서 모듈 해석 실패 — Playwright e2e 로 검증.
 * 그러나 정책 자체 (dev 면 _debug 노출 / prod 면 숨김) 는 buildErrorBody pure
 * function 으로 분리돼 있어 여기서 직접 테스트한다.
 *
 * audit #69 후속.
 */

// errors-body.ts 는 NextResponse / Sentry 의존성 없는 pure 모듈 — node:test 가능.
// errors.ts 본체는 이 파일에서 buildErrorBody 를 import 해서 사용.
import { buildErrorBody, extractMessage } from './errors-body.ts'

describe('extractMessage', () => {
  it('null/undefined → "unknown"', () => {
    assert.equal(extractMessage(null), 'unknown')
    assert.equal(extractMessage(undefined), 'unknown')
  })

  it('Error 인스턴스 → .message', () => {
    assert.equal(extractMessage(new Error('boom')), 'boom')
  })

  it('PostgREST-like { message } → 그대로', () => {
    assert.equal(
      extractMessage({ message: 'duplicate key', code: '23505' }),
      'duplicate key',
    )
  })

  it('message 없는 객체 → "unknown"', () => {
    assert.equal(extractMessage({ code: '23505' }), 'unknown')
  })
})

describe('buildErrorBody', () => {
  it('prod: _debug 필드 없음 — 원본 메시지 client 노출 차단', () => {
    const body = buildErrorBody({
      code: 'DB_ERROR',
      userMessage: '일시적인 오류가 발생했어요',
      originalMessage: 'duplicate key value violates unique constraint "orders_pkey"',
      isDev: false,
    })
    assert.equal(body.code, 'DB_ERROR')
    assert.equal(body.message, '일시적인 오류가 발생했어요')
    assert.equal(body._debug, undefined)
    assert.equal('_debug' in body, false)
  })

  it('dev: _debug 에 원본 메시지 노출', () => {
    const body = buildErrorBody({
      code: 'EXTERNAL_FAIL',
      userMessage: '외부 서비스 오류',
      originalMessage: 'Toss 4xx: INVALID_CARD',
      isDev: true,
    })
    assert.equal(body.code, 'EXTERNAL_FAIL')
    assert.equal(body.message, '외부 서비스 오류')
    assert.equal(body._debug, 'Toss 4xx: INVALID_CARD')
  })

  it('각 ApiErrorCode 별로 동일 정책 (DB_ERROR / EXTERNAL_FAIL / INTERNAL)', () => {
    const codes = ['DB_ERROR', 'EXTERNAL_FAIL', 'INTERNAL'] as const
    for (const code of codes) {
      const prodBody = buildErrorBody({
        code,
        userMessage: 'm',
        originalMessage: 'secret',
        isDev: false,
      })
      assert.equal('_debug' in prodBody, false, `${code} prod 에 _debug 노출됨`)
    }
  })

  it('보안 회귀 가드: prod 에서 schema/제약 이름 누설 X', () => {
    // 실제 PostgreSQL 에러 메시지 시나리오
    const realPgError =
      'insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey"'
    const body = buildErrorBody({
      code: 'DB_ERROR',
      userMessage: '일시적인 오류가 발생했어요',
      originalMessage: realPgError,
      isDev: false,
    })
    // _debug 없어야 함 — schema 이름 (orders, orders_user_id_fkey) 누설 차단
    assert.ok(!('_debug' in body))
    assert.ok(!JSON.stringify(body).includes('orders_user_id_fkey'))
    assert.ok(!JSON.stringify(body).includes('foreign key'))
  })
})
