import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MARKETING_POLICY_VERSION,
  CONSENT_LABEL,
  type ConsentChannel,
} from './consent.ts'

/**
 * lib/consent.ts — 마케팅 동의 정책 SSOT (정보통신망법 §50).
 *
 * 회귀 가드:
 *  - MARKETING_POLICY_VERSION 형식 `vN`
 *  - 채널 라벨에 "광고·마케팅" 의미 포함 (법적 표기 invariant)
 *  - email + sms 양쪽 정의됨
 */

describe('MARKETING_POLICY_VERSION', () => {
  it('형식 `vN` (N >= 1)', () => {
    assert.match(MARKETING_POLICY_VERSION, /^v\d+$/)
  })

  it('현재 v1 (최초 분리 동의)', () => {
    assert.equal(MARKETING_POLICY_VERSION, 'v1')
  })
})

describe('CONSENT_LABEL', () => {
  it('email + sms 채널 모두 정의', () => {
    assert.ok(CONSENT_LABEL.email.length > 0)
    assert.ok(CONSENT_LABEL.sms.length > 0)
  })

  it('email 라벨에 "이메일" 단어 포함', () => {
    assert.match(CONSENT_LABEL.email, /이메일/)
  })

  it('sms 라벨에 "SMS" 또는 "카카오톡" 포함', () => {
    assert.match(CONSENT_LABEL.sms, /SMS|카카오톡/)
  })

  it('법적 회귀 — 모든 채널 라벨에 "혜택" 또는 "이벤트" 단어 (광고성 명시)', () => {
    const channels: ConsentChannel[] = ['email', 'sms']
    for (const c of channels) {
      assert.match(
        CONSENT_LABEL[c],
        /혜택|이벤트|광고|마케팅/,
        `${c} 라벨 "광고성" 의미 누락`,
      )
    }
  })
})
