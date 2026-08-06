import { test } from 'node:test'
import assert from 'node:assert/strict'
import { userFacingError } from './error-message.ts'

const FALLBACK = '네트워크가 불안정해요. 다시 시도해 주세요'

test('★브라우저 영문 오류는 고객에게 안 보인다 — 15곳이 그러던 회귀', () => {
  /**
   * 2026-08-05: 화면 15곳이 `e instanceof Error ? e.message : '한국어'` 였다.
   * 삼항이 뒤집혀 있어서, fetch 실패(=TypeError=Error 인스턴스)면 고객이
   * **Failed to fetch / Load failed** 를 그대로 봤다. 준비된 한국어는
   * 영영 안 뜨는 죽은 코드였고, 승인·주문취소·금액변경 같은 돈 화면이
   * 다 포함돼 있었다.
   */
  for (const msg of [
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
    'Unexpected token < in JSON at position 0',
    'AbortError: The operation was aborted.',
  ]) {
    assert.equal(userFacingError(new Error(msg), FALLBACK), FALLBACK, msg)
  }
})

test('우리가 던진 한국어 메시지는 그대로 보여준다', () => {
  assert.equal(
    userFacingError(new Error('사진이 너무 커요 (10MB 이하)'), FALLBACK),
    '사진이 너무 커요 (10MB 이하)',
  )
  assert.equal(userFacingError('이미 처리된 주문이에요.', FALLBACK), '이미 처리된 주문이에요.')
  // 자모만 있어도 우리 것으로 본다(드물지만 안전한 쪽)
  assert.equal(userFacingError(new Error('ㅇㅇ 실패'), FALLBACK), 'ㅇㅇ 실패')
})

test('Error 가 아닌 것·빈 값도 폴백으로', () => {
  for (const e of [undefined, null, 0, {}, [], new Error(''), 'timeout']) {
    assert.equal(userFacingError(e, FALLBACK), FALLBACK)
  }
})
