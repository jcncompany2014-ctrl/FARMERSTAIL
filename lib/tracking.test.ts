import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrackerAuthError, mapTrackerStatusCode, trackerAuthHeader } from './tracking.ts'

/**
 * 2026-09-25 출시 전 점검 3차 — tracker.delivery 가 키를 요구하게 바뀌었는데
 * 우리는 헤더 없이 불러 자동 배송완료가 한 번도 안 됐고 크론은 초록이었다.
 */

test('trackerAuthHeader: 둘 다 있어야 헤더를 만든다 (문서 형식 그대로)', () => {
  assert.equal(trackerAuthHeader('abc', 'xyz'), 'TRACKQL-API-KEY abc:xyz')
  assert.equal(trackerAuthHeader(' abc ', ' xyz\n'), 'TRACKQL-API-KEY abc:xyz')
  assert.equal(trackerAuthHeader(undefined, 'xyz'), null)
  assert.equal(trackerAuthHeader('abc', ''), null)
  assert.equal(trackerAuthHeader('  ', 'xyz'), null)
})

test('isTrackerAuthError: 실측된 키 누락 응답을 인증 오류로 본다', () => {
  // 2026-09-25 실측 응답 그대로
  assert.equal(
    isTrackerAuthError([
      { message: 'Authorization header is missing.', extensions: { code: 'FORBIDDEN' } },
    ]),
    true,
  )
  // 만료(무료 키 21일) — 코드가 UNAUTHENTICATED 로 오는 경우
  assert.equal(isTrackerAuthError([{ message: 'token expired', extensions: { code: 'UNAUTHENTICATED' } }]), true)
  // 코드 없이 문구만 오는 경우도
  assert.equal(isTrackerAuthError([{ message: 'Invalid API key' }]), true)
})

test('isTrackerAuthError: 송장 없음은 인증 오류가 아니다', () => {
  assert.equal(isTrackerAuthError([{ message: 'Tracking not found', extensions: { code: 'NOT_FOUND' } }]), false)
  assert.equal(isTrackerAuthError([]), false)
  assert.equal(isTrackerAuthError(undefined), false)
})

test('mapTrackerStatusCode: 배송완료만 delivered', () => {
  assert.equal(mapTrackerStatusCode('DELIVERED'), 'delivered')
  assert.equal(mapTrackerStatusCode('delivered'), 'delivered')
  assert.equal(mapTrackerStatusCode('IN_TRANSIT'), 'in_transit')
  assert.equal(mapTrackerStatusCode(null), 'unknown')
})
