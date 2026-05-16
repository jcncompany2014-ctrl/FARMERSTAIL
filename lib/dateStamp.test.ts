import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_SUBSCRIBE,
  getStampSnapshot,
  getServerStampSnapshot,
} from './dateStamp.ts'

/**
 * lib/dateStamp.ts — editorial stamp (useSyncExternalStore client snapshot).
 *
 * 회귀 가드:
 *  - 같은 날 동안 동일 객체 참조 (Object.is, React 무한 재렌더 차단)
 *  - getServerStampSnapshot 은 항상 null (hydration mismatch 차단)
 *  - weekday/day/month 형식 (UPPERCASE / 2자리 zero-pad / 영문 약어)
 *  - EMPTY_SUBSCRIBE 는 noop pair
 */

describe('getStampSnapshot — stable reference', () => {
  it('같은 호출 → 동일 객체 참조 (useSyncExternalStore Object.is 통과)', () => {
    const a = getStampSnapshot()
    const b = getStampSnapshot()
    assert.equal(a, b, 'reference 가 다르면 React 무한 재렌더')
  })

  it('연속 3회 호출 — 모두 동일 참조', () => {
    const a = getStampSnapshot()
    const b = getStampSnapshot()
    const c = getStampSnapshot()
    assert.equal(a, b)
    assert.equal(b, c)
  })
})

describe('getStampSnapshot — 형식', () => {
  it('weekday — 영문 3자 UPPERCASE (MON/TUE/...)', () => {
    const s = getStampSnapshot()
    assert.match(s.weekday, /^(MON|TUE|WED|THU|FRI|SAT|SUN)$/)
  })

  it('day — 2자리 zero-pad (01~31)', () => {
    const s = getStampSnapshot()
    assert.match(s.day, /^\d{2}$/)
    const n = parseInt(s.day, 10)
    assert.ok(n >= 1 && n <= 31)
  })

  it('month — 영문 3자 UPPERCASE (JAN/FEB/...)', () => {
    const s = getStampSnapshot()
    assert.match(s.month, /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/)
  })
})

describe('getServerStampSnapshot', () => {
  it('항상 null (hydration mismatch 방지)', () => {
    assert.equal(getServerStampSnapshot(), null)
    assert.equal(getServerStampSnapshot(), null)
  })
})

describe('EMPTY_SUBSCRIBE', () => {
  it('함수 — () => () => {}', () => {
    assert.equal(typeof EMPTY_SUBSCRIBE, 'function')
    const unsubscribe = EMPTY_SUBSCRIBE()
    assert.equal(typeof unsubscribe, 'function')
  })

  it('unsubscribe 호출 시 throw 없음 (noop)', () => {
    const unsubscribe = EMPTY_SUBSCRIBE()
    assert.doesNotThrow(() => unsubscribe())
  })
})
