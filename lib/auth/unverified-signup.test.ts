import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUnverifiedPurgeCandidate, UNVERIFIED_SIGNUP_RETENTION_DAYS } from './unverified-signup.ts'

const NOW = Date.parse('2026-10-13T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const old = {
  id: 'u1',
  created_at: new Date(NOW - 31 * DAY).toISOString(),
  email_confirmed_at: null,
  confirmed_at: null,
  last_sign_in_at: null,
  app_metadata: { provider: 'email', providers: ['email'] },
}

test('30일 지난, 인증·로그인 안 한 이메일 가입은 대상', () => {
  assert.equal(UNVERIFIED_SIGNUP_RETENTION_DAYS, 30)
  assert.equal(isUnverifiedPurgeCandidate(old, NOW), true)
})

test('30일이 안 지났으면 대상 아님', () => {
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: new Date(NOW - 29 * DAY).toISOString() }, NOW), false)
})

test('인증했거나 로그인한 적 있으면 대상 아님', () => {
  assert.equal(isUnverifiedPurgeCandidate({ ...old, email_confirmed_at: '2026-09-02T00:00:00Z' }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, confirmed_at: '2026-09-02T00:00:00Z' }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, last_sign_in_at: '2026-09-02T00:00:00Z' }, NOW), false)
})

test('카카오·애플·여러 로그인 수단은 대상 아님', () => {
  assert.equal(isUnverifiedPurgeCandidate({ ...old, app_metadata: { provider: 'kakao', providers: ['kakao'] } }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, app_metadata: { provider: 'apple', providers: ['apple'] } }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, app_metadata: { provider: 'email', providers: ['email', 'kakao'] } }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, app_metadata: null }, NOW), false)
})

test('가입 시각을 모르면 지우지 않는다', () => {
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: null }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: 'not-a-date' }, NOW), false)
})
