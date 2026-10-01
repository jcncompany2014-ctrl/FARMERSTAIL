import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRIAL_STAMP_COPY, trialPushLabel } from './trial-notify-copy.ts'

test('체험단 도장 알림 문구 — 회차가 아니라 기간·총액으로 (사장님 "56일치 밥이 총 400원이에요")', () => {
  const b = TRIAL_STAMP_COPY.body({ dogName: '낑콩', cheap: 4, half: 4 })
  assert.equal(b, '낑콩이 56일치 밥이 총 400원이에요. 지금 플랜을 고르고 카드를 등록해 주세요.')
  // 관리자가 회차·단가를 바꾸면 기간·총액도 따라간다(단가는 청구와 같이 최소 100원).
  assert.match(TRIAL_STAMP_COPY.body({ dogName: '펀치', cheap: 2, half: 4, cheapPrice: 1000 }), /^펀치 28일치 밥이 총 2,000원이에요\./)
  assert.match(TRIAL_STAMP_COPY.body({ dogName: '펀치', cheap: 4, half: 4, cheapPrice: 10 }), /총 400원/)
  assert.equal(
    TRIAL_STAMP_COPY.body({ dogName: '펀치', cheap: 0, half: 4 }),
    '펀치 56일치 밥이 반값이에요. 지금 플랜을 고르고 카드를 등록해 주세요.',
  )
  assert.match(TRIAL_STAMP_COPY.body({ dogName: null, cheap: 4, half: 4 }), /^56일치 밥이 총 400원이에요\. 우리 아이를 등록/)
  for (const s of [TRIAL_STAMP_COPY.title, b]) {
    assert.doesNotMatch(s, /%|언제든/)
    assert.doesNotMatch(s, /박스 \d+번/, '회차로 말하지 않는다')
  }
})

test('관리자 결과 한 줄 — 갔으면 보냄, 못 갔으면 이유와 "직접 알려 주세요"', () => {
  assert.equal(trialPushLabel({ sent: 1, reason: null, url: '/x' }), '앱 알림을 보냈어요.')
  assert.match(trialPushLabel({ sent: 0, reason: 'QUIET_HOURS', url: '/x' }), /조용한 시간/)
  assert.match(trialPushLabel({ sent: 0, reason: null, url: '/x' }), /기기가 없어요.*직접 알려/)
  assert.match(trialPushLabel({ sent: 0, reason: 'PUSH_THREW', url: '' }), /직접 알려/)
})
