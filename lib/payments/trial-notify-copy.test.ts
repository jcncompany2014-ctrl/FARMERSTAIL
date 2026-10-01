import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRIAL_STAMP_COPY, trialPushLabel } from './trial-notify-copy.ts'

test('체험단 도장 알림 문구 — 혜택 회차·강아지 이름·카드 등록 안내, 금지어 없음', () => {
  const b = TRIAL_STAMP_COPY.body({ dogName: '낑콩', cheap: 4, half: 4 })
  assert.equal(b, '낑콩이 첫 박스 4번은 100원이에요. 지금 플랜을 고르고 카드를 등록해 주세요.')
  assert.equal(
    TRIAL_STAMP_COPY.body({ dogName: '펀치', cheap: 0, half: 4 }),
    '펀치 첫 박스 4번은 반값이에요. 지금 플랜을 고르고 카드를 등록해 주세요.',
  )
  assert.match(TRIAL_STAMP_COPY.body({ dogName: null, cheap: 4, half: 4 }), /^첫 박스 4번은 100원이에요\. 우리 아이를 등록/)
  for (const s of [TRIAL_STAMP_COPY.title, b]) assert.doesNotMatch(s, /%|언제든/)
})

test('관리자 결과 한 줄 — 갔으면 보냄, 못 갔으면 이유와 "직접 알려 주세요"', () => {
  assert.equal(trialPushLabel({ sent: 1, reason: null, url: '/x' }), '앱 알림을 보냈어요.')
  assert.match(trialPushLabel({ sent: 0, reason: 'QUIET_HOURS', url: '/x' }), /조용한 시간/)
  assert.match(trialPushLabel({ sent: 0, reason: null, url: '/x' }), /기기가 없어요.*직접 알려/)
  assert.match(trialPushLabel({ sent: 0, reason: 'PUSH_THREW', url: '' }), /직접 알려/)
})
