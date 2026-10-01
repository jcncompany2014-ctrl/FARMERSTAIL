import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NO_CANCEL_CONSENT_VERSION,
  isCurrentNoCancelConsent,
  noCancelConsentBody,
  selfCancelBlockedByConsent,
} from './no-cancel-consent.ts'

describe('결제 후 취소 제한 동의 — 결제 전에 동의한 박스만 막는다', () => {
  it('★결제 전에 동의 → 막는다', () => {
    assert.equal(
      selfCancelBlockedByConsent({ consentAt: '2026-10-02T03:00:00Z', paidAt: '2026-10-10T00:10:00Z' }),
      true,
    )
  })
  it('★동의 기록이 없으면(기존 서포터즈·옛 화면 등록) 막지 않는다 — 게시된 정책대로 발송 전 취소', () => {
    assert.equal(selfCancelBlockedByConsent({ consentAt: null, paidAt: '2026-10-06T00:10:00Z' }), false)
    assert.equal(selfCancelBlockedByConsent({ consentAt: undefined, paidAt: '2026-10-06T00:10:00Z' }), false)
  })
  it('★결제 뒤에 동의(카드 재등록)했으면 그 전에 결제된 박스는 막지 않는다', () => {
    assert.equal(
      selfCancelBlockedByConsent({ consentAt: '2026-10-11T00:00:00Z', paidAt: '2026-10-10T00:10:00Z' }),
      false,
    )
  })
  it('시각을 모르거나 깨졌으면 고객에게 불리하게 읽지 않는다', () => {
    assert.equal(selfCancelBlockedByConsent({ consentAt: '2026-10-02T03:00:00Z', paidAt: null }), false)
    assert.equal(selfCancelBlockedByConsent({ consentAt: 'not-a-date', paidAt: '2026-10-10T00:10:00Z' }), false)
  })
  it('지금 버전만 동의로 친다', () => {
    assert.equal(isCurrentNoCancelConsent(NO_CANCEL_CONSENT_VERSION), true)
    assert.equal(isCurrentNoCancelConsent('2026-01-01'), false)
    assert.equal(isCurrentNoCancelConsent(''), false)
    assert.equal(isCurrentNoCancelConsent(undefined), false)
    assert.equal(isCurrentNoCancelConsent(true), false)
  })
  it('안내 문장 — 결제 후 취소 불가 · 결제 전 미루기/해지 · 하자 환불을 다 말하고, 금지어가 없다', () => {
    const body = noCancelConsentBody('콩이')
    assert.match(body, /콩이 몫/)
    assert.match(body, /결제된 박스는 단순 변심으로 취소·환불할 수 없어요/)
    assert.match(body, /결제 전까지 정기배송 화면에서 미루거나 해지/)
    assert.match(body, /문제가 있으면 환불/)
    assert.doesNotMatch(body, /언제든|처방|%|연어|수요일/)
    assert.match(noCancelConsentBody(null), /우리 아이 몫/)
  })
})
