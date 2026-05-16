import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { isAuthorizedCronRequest } from './cron-auth.ts'

/**
 * lib/cron-auth.ts — Vercel Cron Bearer 검증 (보안 critical).
 *
 * 회귀 가드:
 *  - secret 매치 시 true
 *  - secret 미설정 + dev → true (로컬 편의)
 *  - secret 미설정 + prod → false (env.ts 가 startup 차단하지만 방어)
 *  - timing-safe 비교 (길이 다르면 빠른 false, 같은 길이만 timingSafeEqual)
 *  - "Bearer " 접두사 강제
 */

function makeReq(authHeader: string | null): Request {
  const headers = new Headers()
  if (authHeader !== null) headers.set('authorization', authHeader)
  return new Request('http://test/api/cron/x', { headers })
}

describe('isAuthorizedCronRequest — secret 정상 설정', () => {
  const ORIGINAL = {
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  }

  before(() => {
    process.env.CRON_SECRET = 'test-secret-abc123'
    // production-like behavior — secret 매치만 통과
    process.env.NODE_ENV = 'production'
  })

  after(() => {
    if (ORIGINAL.CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = ORIGINAL.CRON_SECRET
    }
    if (ORIGINAL.NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL.NODE_ENV
    }
  })

  it('정상 Bearer + 일치 secret → true', () => {
    const req = makeReq('Bearer test-secret-abc123')
    assert.equal(isAuthorizedCronRequest(req), true)
  })

  it('Authorization 헤더 없음 → false', () => {
    const req = makeReq(null)
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('Bearer 누락 (raw secret 만) → false', () => {
    const req = makeReq('test-secret-abc123')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('다른 secret → false', () => {
    const req = makeReq('Bearer wrong-secret-xyz')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('길이 다른 secret → false (timingSafeEqual length mismatch)', () => {
    const req = makeReq('Bearer short')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('길이 같은 random secret → false', () => {
    // test-secret-abc123 와 같은 길이의 다른 문자열
    const sameLen = 'XXXX-XXXXXX-XXXXXX'.slice(0, 'test-secret-abc123'.length)
    const req = makeReq(`Bearer ${sameLen}`)
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('Bearer 대신 Basic 등 다른 scheme → false', () => {
    const req = makeReq('Basic test-secret-abc123')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('Bearer 뒤 공백 누락 → false', () => {
    const req = makeReq('Bearertest-secret-abc123')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('대소문자 — "bearer" (소문자) → false (strict)', () => {
    const req = makeReq('bearer test-secret-abc123')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('빈 Bearer (스페이스만) → false', () => {
    const req = makeReq('Bearer ')
    assert.equal(isAuthorizedCronRequest(req), false)
  })
})

describe('isAuthorizedCronRequest — secret 미설정 + dev', () => {
  const ORIGINAL = {
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  }

  before(() => {
    delete process.env.CRON_SECRET
    process.env.NODE_ENV = 'development'
  })

  after(() => {
    if (ORIGINAL.CRON_SECRET !== undefined) {
      process.env.CRON_SECRET = ORIGINAL.CRON_SECRET
    }
    if (ORIGINAL.NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL.NODE_ENV
    }
  })

  it('dev + secret 미설정 → true (로컬 cron 트리거 편의)', () => {
    const req = makeReq(null)
    assert.equal(isAuthorizedCronRequest(req), true)
  })

  it('dev + secret 미설정 — 헤더 있어도 true', () => {
    const req = makeReq('Bearer anything')
    assert.equal(isAuthorizedCronRequest(req), true)
  })
})

describe('isAuthorizedCronRequest — secret 미설정 + prod (defense in depth)', () => {
  const ORIGINAL = {
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  }

  before(() => {
    delete process.env.CRON_SECRET
    process.env.NODE_ENV = 'production'
  })

  after(() => {
    if (ORIGINAL.CRON_SECRET !== undefined) {
      process.env.CRON_SECRET = ORIGINAL.CRON_SECRET
    }
    if (ORIGINAL.NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL.NODE_ENV
    }
  })

  it('prod + secret 미설정 → false (env.ts 가 차단하지만 방어)', () => {
    const req = makeReq('Bearer anything')
    assert.equal(isAuthorizedCronRequest(req), false)
  })

  it('prod + secret 미설정 + 헤더 없음 → false', () => {
    const req = makeReq(null)
    assert.equal(isAuthorizedCronRequest(req), false)
  })
})
