import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  // 2026-10-09 실측 — 틀린 키·만료 키 모두 HTTP 200 + 이 응답
  assert.equal(isTrackerAuthError([{ message: 'Invalid or expired token.', extensions: { code: 'UNAUTHENTICATED' } }]), true)
})

test('tracking-poll: 배송 중 주문이 없는 날에도 키를 조회만으로 점검하고, 거절이면 빨간불 (2026-10-09)', () => {
  /**
   * 무료 키는 21일마다 만료된다. 키를 배송 중 주문에만 쓰면 만료돼도 다음 발송일 18:30 까지 모른다.
   * 점검은 조회만 — 주문 UPDATE·푸시·메일이 끼어들면 고객에게 닿는다.
   */
  const src = readFileSync(join(process.cwd(), 'app', 'api', 'cron', 'tracking-poll', 'route.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
  assert.match(src, /if \(targets\.length === 0 && authHeader\) \{\s*keyCheck = await checkTrackerKey\(supabase, authHeader\)/, '배송 중 주문이 없는 날 키 점검을 안 한다')
  assert.match(src, /if \(keyCheck === 'rejected'\) \{\s*return NextResponse\.json\(\s*\{\s*ok: false,\s*reason: 'TRACKER_AUTH_REJECTED'[\s\S]{0,300}?\{ status: 500 \}/, '키 거절을 빨간불(5xx)로 올리지 않는다')
  const fn = src.slice(src.indexOf('async function checkTrackerKey('))
  assert.ok(fn.length > 100, '키 점검 함수를 못 찾았다')
  assert.match(fn, /return isTrackerAuthError\(json\.errors\) \? 'rejected' : 'ok'/, '키 점검이 인증 거절을 가려내지 않는다')
  assert.doesNotMatch(fn, /\.update\(|\.insert\(|\.delete\(|pushToUser|notifyOrder/, '키 점검이 조회 말고 다른 일을 한다 — 고객에게 닿는다')
  assert.match(src, /keyCheck,\n\s*\}\)\n\}/, '정상 결과 요약에 keyCheck 가 없다 — cron_health 로 확인할 수 없다')
  // 응답에 넣어도 cron_health 기록은 허용 목록(pickSummary)만 남긴다 — 첫 배포에서 실제로 잘려 나갔다.
  const tracking = readFileSync(join(process.cwd(), 'lib', 'cron-tracking.ts'), 'utf8').replace(/\r\n/g, '\n')
  const allow = tracking.slice(tracking.indexOf('function pickSummary('), tracking.indexOf('const out: Record<string, unknown> = {}'))
  assert.ok(allow.length > 50, 'pickSummary 허용 목록을 못 찾았다')
  assert.match(allow, /^\s*'keyCheck',$/m, "cron_health 기록 허용 목록에 'keyCheck' 가 없다 — 키 점검 결과가 잘려 나간다")
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
