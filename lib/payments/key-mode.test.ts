import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyMode, tossKeyStatus, describeTossKeyStatus } from './key-mode.ts'

/**
 * 첫 실결제 때 딱 한 번 드러나는 사고들을 코드로 미리 잡는다(2026-07-26 감사).
 * 실제 키 값은 절대 테스트에 넣지 않는다 — 접두사 형태만 쓴다.
 */

test('키 접두사로 환경을 판정한다', () => {
  assert.equal(keyMode('test_ck_XXXX'), 'test')
  assert.equal(keyMode('test_sk_XXXX'), 'test')
  assert.equal(keyMode('test_gck_XXXX'), 'test')
  assert.equal(keyMode('live_ck_XXXX'), 'live')
  assert.equal(keyMode('live_sk_XXXX'), 'live')
  assert.equal(keyMode('live_gck_XXXX'), 'live')
  assert.equal(keyMode(''), 'missing')
  assert.equal(keyMode(undefined), 'missing')
  assert.equal(keyMode('   '), 'missing')
  assert.equal(keyMode('ck_something'), 'unknown')
})

test('★ 시크릿만 운영키로 바꾸면 불일치로 잡힌다 (출시일 최다 실수)', () => {
  const s = tossKeyStatus('test_ck_XXXX', 'live_sk_XXXX')
  assert.equal(s.mismatched, true)
  assert.equal(s.isLive, false)
  assert.equal(describeTossKeyStatus(s).tone, 'danger')
})

test('★ 반대 조합(결제창만 운영키)도 잡힌다', () => {
  const s = tossKeyStatus('live_ck_XXXX', 'test_sk_XXXX')
  assert.equal(s.mismatched, true)
  assert.equal(describeTossKeyStatus(s).tone, 'danger')
})

test('★ 테스트키인 채로 출시하면 경고 — 돈이 안 들어온다', () => {
  const s = tossKeyStatus('test_ck_XXXX', 'test_sk_XXXX')
  assert.equal(s.isLive, false)
  assert.equal(s.mismatched, false)
  const d = describeTossKeyStatus(s)
  assert.equal(d.tone, 'warn')
  assert.match(d.detail, /실제 입금이 없어요/)
})

test('둘 다 운영키면 실결제 모드', () => {
  const s = tossKeyStatus('live_ck_XXXX', 'live_sk_XXXX')
  assert.equal(s.isLive, true)
  assert.equal(s.mismatched, false)
  assert.equal(describeTossKeyStatus(s).tone, 'ok')
})

test('키가 없으면 불일치가 아니라 미설정으로 본다', () => {
  const s = tossKeyStatus(undefined, 'live_sk_XXXX')
  assert.equal(s.incomplete, true)
  assert.equal(s.mismatched, false, '없는 걸 불일치로 부르면 안내가 엉뚱해진다')
  assert.match(describeTossKeyStatus(s).detail, /결제창이 안 뜹니다/)
})

test('둘 다 없으면 결제 자체가 불가능하다고 알린다', () => {
  const s = tossKeyStatus(null, null)
  assert.equal(s.incomplete, true)
  assert.match(describeTossKeyStatus(s).detail, /결제를 받을 수 없어요/)
})

test('안내 문구에 키 값이 절대 들어가지 않는다', () => {
  const s = tossKeyStatus('live_ck_SECRETVALUE', 'test_sk_SECRETVALUE')
  const d = describeTossKeyStatus(s)
  assert.ok(!d.detail.includes('SECRETVALUE'))
  assert.ok(!d.title.includes('SECRETVALUE'))
})
