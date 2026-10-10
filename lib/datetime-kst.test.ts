/**
 * datetime-kst 단위 테스트 — datetime-local 입력은 KST 로 읽는다.
 *
 * 회귀 방지(2026-09-26 출시 전 점검 6차): 프로모션 폼이 보낸 "2026-09-25T17:11" 을
 * 서버(UTC)가 new Date() 로 읽어 9/26 02:11 KST 에 열렸다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseKstLocalDateTime, kstKoDateTimeParts, formatKstKoDateTime } from './datetime-kst.ts'

describe('kstKoDateTimeParts — 실행 환경 ICU 와 무관하게 "오전/오후"', () => {
  it('KST 로 바꾸고 오전/오후 12시간제(앞자리 0)', () => {
    assert.deepEqual(kstKoDateTimeParts('2026-09-25T22:00:00Z'), { date: '2026. 09. 26.', time: '오전 07:00' })
    assert.deepEqual(kstKoDateTimeParts('2026-09-29T06:20:00Z'), { date: '2026. 09. 29.', time: '오후 03:20' })
  })
  it('자정은 오전 12시, 정오는 오후 12시 — "24" 나 "00" 이 아니다', () => {
    assert.deepEqual(kstKoDateTimeParts('2026-12-31T15:05:00Z'), { date: '2027. 01. 01.', time: '오전 12:05' })
    assert.deepEqual(kstKoDateTimeParts('2026-10-01T03:00:00Z'), { date: '2026. 10. 01.', time: '오후 12:00' })
  })
  it('한 줄 형식 · 빈 값/잘못된 값', () => {
    assert.equal(formatKstKoDateTime('2026-09-30T04:40:00Z'), '2026. 09. 30. 오후 01:40')
    assert.equal(formatKstKoDateTime(null), '-')
    assert.equal(kstKoDateTimeParts('nope'), null)
  })
})

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
