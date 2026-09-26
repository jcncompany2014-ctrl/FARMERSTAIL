/**
 * datetime-kst 단위 테스트 — datetime-local 입력은 KST 로 읽는다.
 *
 * 회귀 방지(2026-09-26 출시 전 점검 6차): 프로모션 폼이 보낸 "2026-09-25T17:11" 을
 * 서버(UTC)가 new Date() 로 읽어 9/26 02:11 KST 에 열렸다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseKstLocalDateTime } from './datetime-kst.ts'

describe('parseKstLocalDateTime', () => {
  it('오프셋 없는 datetime-local 값은 KST 로 읽는다', () => {
    assert.equal(parseKstLocalDateTime('2026-09-25T17:11').toISOString(), '2026-09-25T08:11:00.000Z')
    assert.equal(parseKstLocalDateTime('2026-11-02T10:00:30').toISOString(), '2026-11-02T01:00:30.000Z')
  })
  it('KST 자정은 UTC 전날 15시 — 날짜 경계', () => {
    assert.equal(parseKstLocalDateTime('2027-01-01T00:00').toISOString(), '2026-12-31T15:00:00.000Z')
  })
  it('오프셋·Z 가 붙은 값은 그대로', () => {
    assert.equal(parseKstLocalDateTime('2026-11-02T10:00:00Z').toISOString(), '2026-11-02T10:00:00.000Z')
    assert.equal(parseKstLocalDateTime('2026-11-02T10:00:00+09:00').toISOString(), '2026-11-02T01:00:00.000Z')
  })
  it('잘못된 값은 Invalid Date (호출부가 400 으로 거른다)', () => {
    assert.ok(Number.isNaN(parseKstLocalDateTime('nope').getTime()))
  })
})
