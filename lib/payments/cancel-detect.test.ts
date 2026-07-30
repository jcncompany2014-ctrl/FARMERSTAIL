import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUserCancelledPayment } from './cancel-detect.ts'

/**
 * 사장님 제보 2026-07-30 (IMG_4768): 결제창을 닫았더니 빨간 "취소되었습니다."
 * 막다른 화면이 떴다. 취소는 실패가 아니다.
 * 반대 방향도 지킨다 — 진짜 실패를 취소로 삼켜서 조용히 넘기면 고객이 왜 안
 * 되는지 영원히 모른다.
 */

test('★ 재현 케이스: 실측 메시지 "취소되었습니다." → 취소로 판정', () => {
  assert.equal(isUserCancelledPayment(new Error('취소되었습니다.')), true)
})

test('토스 취소 코드들 → 취소로 판정', () => {
  for (const code of ['USER_CANCEL', 'PAY_PROCESS_CANCELED', 'USER_CANCELED']) {
    assert.equal(isUserCancelledPayment({ code }), true, code)
  }
})

test('코드가 취소면 메시지가 없어도 취소', () => {
  assert.equal(isUserCancelledPayment({ code: 'USER_CANCEL' }), true)
})

test('★ 진짜 실패는 취소로 삼키지 않는다 — 고객이 이유를 알아야 한다', () => {
  const failures = [
    new Error('카드 한도를 초과했어요'),
    new Error('잔액이 부족합니다'),
    new Error('카드사에서 거절했습니다'),
    new Error('유효하지 않은 카드번호입니다'),
    new Error('만료된 카드입니다'),
    { code: 'REJECT_CARD_COMPANY', message: '카드사 승인 거절' },
    new Error('결제 서버와 통신할 수 없어요'),
  ]
  for (const f of failures) {
    assert.equal(isUserCancelledPayment(f), false, String(f))
  }
})

test('실패 사유 + 취소 단어가 같이 온 메시지는 실패로 남긴다', () => {
  // "한도 초과로 취소되었습니다" — 취소로 삼키면 고객은 한도 문제를 모른다.
  assert.equal(
    isUserCancelledPayment(new Error('한도 초과로 취소되었습니다')),
    false,
  )
})

test('문자열로 던져진 경우도 처리', () => {
  assert.equal(isUserCancelledPayment('취소되었습니다'), true)
  assert.equal(isUserCancelledPayment('알 수 없는 오류'), false)
})

test('빈 값·이상한 값은 실패로 (조용히 넘기지 않는다)', () => {
  for (const v of [null, undefined, '', {}, 0, [], new Error('')]) {
    assert.equal(isUserCancelledPayment(v), false, String(v))
  }
})
