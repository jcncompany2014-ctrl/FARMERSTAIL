import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUnverifiedPurgeCandidate, UNVERIFIED_PURGE_APPLIES_FROM, UNVERIFIED_SIGNUP_RETENTION_DAYS } from './unverified-signup.ts'

// 기준 '지금'은 적용 시작(10/21) 뒤 — 시작 전 가입은 아래 따로 본다.
const NOW = Date.parse('2026-12-15T00:00:00Z')
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

test('방침 시행(10/21) 전에 가입한 계정은 몇 달이 지나도 대상 아님 — 사장님 10/14 "이때까지 인증 안 한 사람은 냅두고"', () => {
  const start = Date.parse(UNVERIFIED_PURGE_APPLIES_FROM)
  // 9/2 가입(운영의 실제 미인증 1명과 같은 날) — 1년 뒤에도 지우지 않는다
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: '2026-09-02T05:00:00Z' }, start + 365 * DAY), false)
  // 시작 1분 전 가입도 대상 아님, 시작 직후 가입은 30일 뒤 대상
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: new Date(start - 60_000).toISOString() }, start + 60 * DAY), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: new Date(start + 60_000).toISOString() }, start + 31 * DAY), true)
  // 오늘 밤(10/14 02:20 KST) 첫 실행에서는 아무도 대상이 아니다
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: '2026-09-02T05:00:00Z' }, Date.parse('2026-10-13T17:20:00Z')), false)
})

test('가입 시각을 모르면 지우지 않는다', () => {
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: null }, NOW), false)
  assert.equal(isUnverifiedPurgeCandidate({ ...old, created_at: 'not-a-date' }, NOW), false)
})
