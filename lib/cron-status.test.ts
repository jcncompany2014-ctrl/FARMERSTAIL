import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFailureStatus } from './cron-status.ts'

test('★반환된 5xx 는 크론 실패로 기록된다 — 가드 37곳이 조용하던 회귀', () => {
  /**
   * 2026-08-05: 크론 37곳에 "조회 실패면 500 반환" 가드를 넣었는데,
   * trackCron 은 **throw 할 때만** error 로 기록했다. 그래서
   * cron_health·ops-digest·Sentry 세 층 모두에서 여전히 초록이었다 —
   * "실패가 초록으로 집계된다"를 고치려던 수정이 그대로 그 상태였다.
   * 가드를 37곳 고치는 대신 판정 한 곳을 고쳤고, 이 테스트가 그걸 지킨다.
   */
  for (const s of [500, 502, 503, 504, 599]) {
    assert.equal(isFailureStatus(s), true, `${s} 는 실패여야 한다`)
  }
})

test('4xx·2xx 는 실패가 아니다 — 운영 다이제스트를 소음으로 채우지 않는다', () => {
  for (const s of [200, 204, 302, 400, 401, 404, 429, 499]) {
    assert.equal(isFailureStatus(s), false, `${s} 는 실패가 아니다`)
  }
})

test('상태를 못 읽으면 실패로 보지 않는다 — 정상 응답을 오탐하지 않는다', () => {
  for (const s of [undefined, null, NaN, Infinity, '500', {}]) {
    assert.equal(isFailureStatus(s), false)
  }
})
