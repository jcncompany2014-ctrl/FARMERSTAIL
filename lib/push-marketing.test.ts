import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AD_LABEL, AD_OPT_OUT_LINE, isMarketingSendHour, stampMarketingPayload } from './push-marketing.ts'

test('광고 푸시 시간: 08:00~20:59 만 허용 (21~08시는 별도 동의 필요)', () => {
  assert.equal(isMarketingSendHour(7), false)
  assert.equal(isMarketingSendHour(8), true)
  assert.equal(isMarketingSendHour(20), true)
  assert.equal(isMarketingSendHour(21), false)
  assert.equal(isMarketingSendHour(23), false)
  assert.equal(isMarketingSendHour(0), false)
})

test('제목은 (광고) 로 시작하고, 이미 붙은 [광고]·(광고) 는 중복되지 않는다', () => {
  assert.equal(stampMarketingPayload({ title: '가을 이벤트' }).title, `${AD_LABEL} 가을 이벤트`)
  assert.equal(stampMarketingPayload({ title: '[광고] 가을 이벤트' }).title, `${AD_LABEL} 가을 이벤트`)
  assert.equal(stampMarketingPayload({ title: '(광고) 가을 이벤트' }).title, `${AD_LABEL} 가을 이벤트`)
})

test('본문 끝에 수신거부 방법이 붙는다 (본문이 없어도)', () => {
  const s = stampMarketingPayload({ title: 't', body: '구독 시 15% 할인' })
  assert.equal(s.body, `구독 시 15% 할인\n${AD_OPT_OUT_LINE}`)
  assert.equal(stampMarketingPayload({ title: 't' }).body, AD_OPT_OUT_LINE)
  // 두 번 찍어도 한 줄만
  assert.equal(stampMarketingPayload(s).body, s.body)
})

test('url 등 다른 필드는 그대로', () => {
  const s = stampMarketingPayload({ title: 't', body: 'b', url: '/x', tag: 'k' })
  assert.equal(s.url, '/x')
  assert.equal(s.tag, 'k')
})
