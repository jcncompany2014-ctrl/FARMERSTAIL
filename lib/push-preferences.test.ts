import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePrefsPatch, validateQuietHours, PUSH_PREF_DEFAULTS } from './push-preferences.ts'

test('보낸 칸만 담는다', () => {
  const r = parsePrefsPatch({ notify_order: false })
  assert.deepEqual(r, { ok: true, patch: { notify_order: false } })
})

test('모르는 칸·틀린 형·빈 요청은 거절', () => {
  assert.equal(parsePrefsPatch({ user_id: 'someone' }).ok, false)
  assert.equal(parsePrefsPatch({ notify_order: 'false' }).ok, false)
  assert.equal(parsePrefsPatch({ quiet_hours_start: 1.5 }).ok, false)
  assert.equal(parsePrefsPatch({}).ok, false)
  assert.equal(parsePrefsPatch(null).ok, false)
  assert.equal(parsePrefsPatch([]).ok, false)
})

test('방해 금지 시간: 바뀐 뒤의 두 값으로 검사 — 한쪽만 바꿔도 된다', () => {
  const cur = { ...PUSH_PREF_DEFAULTS, quiet_hours_start: 22, quiet_hours_end: 8 }
  assert.equal(validateQuietHours(cur, { quiet_hours_start: 23 }), null)
  assert.equal(validateQuietHours(cur, { quiet_hours_end: 7 }), null)
  assert.equal(validateQuietHours(cur, { quiet_hours_start: null, quiet_hours_end: null }), null)
  assert.notEqual(validateQuietHours(cur, { quiet_hours_start: 8 }), null, '시작=끝은 거절')
  assert.notEqual(validateQuietHours(cur, { quiet_hours_start: null }), null, '한쪽만 끄기는 거절')
  assert.notEqual(validateQuietHours(PUSH_PREF_DEFAULTS, { quiet_hours_start: 22 }), null, '끝 시각 없이 시작만은 거절')
  assert.notEqual(validateQuietHours(cur, { quiet_hours_end: 24 }), null)
})

test('시각을 안 건드리면 검사하지 않는다', () => {
  assert.equal(validateQuietHours(PUSH_PREF_DEFAULTS, { notify_marketing: true }), null)
})
