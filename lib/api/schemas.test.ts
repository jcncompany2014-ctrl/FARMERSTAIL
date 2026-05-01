/**
 * api/schemas.ts unit tests — Zod 스키마 검증 동작.
 *
 * parseRequest 자체는 NextResponse 의존이라 통합 테스트로. 여기선 각 스키마가
 * 받아야 할 / 거부해야 할 입력만 직접 검증.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  zUuid,
  zKrPhone,
  zKrZip,
  zEmail,
  zIsoDate,
  zShortText,
  zAnalysisRequest,
  zPaymentConfirm,
  zOrderCancel,
  zPushSubscribe,
  zPushUnsubscribe,
  zRestockRequest,
  zNewsletterSubscribe,
  zAccountDelete,
  zNativePushRegister,
} from './schemas.ts'

describe('zUuid', () => {
  it('accepts valid UUID v4', () => {
    assert.equal(
      zUuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success,
      true,
    )
  })
  it('rejects invalid UUID', () => {
    assert.equal(zUuid.safeParse('not-a-uuid').success, false)
    assert.equal(zUuid.safeParse('').success, false)
    assert.equal(zUuid.safeParse('123').success, false)
  })
})

describe('zKrPhone', () => {
  it('accepts 010-XXXX-XXXX with hyphens', () => {
    assert.equal(zKrPhone.safeParse('010-1234-5678').success, true)
  })
  it('accepts without hyphens', () => {
    assert.equal(zKrPhone.safeParse('01012345678').success, true)
  })
  it('accepts older 010 / 011 / 016~19', () => {
    assert.equal(zKrPhone.safeParse('011-123-4567').success, true)
    assert.equal(zKrPhone.safeParse('019-999-8888').success, true)
  })
  it('rejects 02 / international / non-mobile', () => {
    assert.equal(zKrPhone.safeParse('02-1234-5678').success, false)
    assert.equal(zKrPhone.safeParse('+82 10 1234 5678').success, false)
  })
})

describe('zKrZip', () => {
  it('accepts 5 digit zip', () => {
    assert.equal(zKrZip.safeParse('12345').success, true)
  })
  it('rejects 4/6 digit', () => {
    assert.equal(zKrZip.safeParse('1234').success, false)
    assert.equal(zKrZip.safeParse('123456').success, false)
  })
})

describe('zEmail', () => {
  it('accepts standard email', () => {
    assert.equal(zEmail.safeParse('user@example.com').success, true)
  })
  it('rejects malformed', () => {
    assert.equal(zEmail.safeParse('not-an-email').success, false)
    assert.equal(zEmail.safeParse('user@').success, false)
  })
})

describe('zIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    assert.equal(zIsoDate.safeParse('2026-05-01').success, true)
  })
  it('rejects other formats', () => {
    assert.equal(zIsoDate.safeParse('2026/05/01').success, false)
    assert.equal(zIsoDate.safeParse('05-01-2026').success, false)
  })
})

describe('zShortText length cap', () => {
  it('accepts up to 200 chars', () => {
    assert.equal(zShortText.safeParse('a'.repeat(200)).success, true)
  })
  it('rejects over 200 chars', () => {
    assert.equal(zShortText.safeParse('a'.repeat(201)).success, false)
  })
})

describe('zAnalysisRequest', () => {
  it('requires UUID analysisId', () => {
    assert.equal(
      zAnalysisRequest.safeParse({
        analysisId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
      true,
    )
    assert.equal(zAnalysisRequest.safeParse({ analysisId: 'foo' }).success, false)
    assert.equal(zAnalysisRequest.safeParse({}).success, false)
  })
})

describe('zPaymentConfirm', () => {
  it('accepts valid payment confirmation body', () => {
    const result = zPaymentConfirm.safeParse({
      paymentKey: 'tossvi_VBDPSrG2A_xxxxxxx',
      orderId: 'order_2026_001',
      amount: 35000,
    })
    assert.equal(result.success, true)
  })
  it('rejects negative or zero amount', () => {
    assert.equal(
      zPaymentConfirm.safeParse({
        paymentKey: 'paymentKey1234',
        orderId: 'order123',
        amount: 0,
      }).success,
      false,
    )
    assert.equal(
      zPaymentConfirm.safeParse({
        paymentKey: 'paymentKey1234',
        orderId: 'order123',
        amount: -100,
      }).success,
      false,
    )
  })
  it('rejects too short paymentKey', () => {
    assert.equal(
      zPaymentConfirm.safeParse({
        paymentKey: 'abc',
        orderId: 'order_2026_001',
        amount: 100,
      }).success,
      false,
    )
  })
  it('rejects amount over 100M (sanity bound)', () => {
    assert.equal(
      zPaymentConfirm.safeParse({
        paymentKey: 'paymentKey1234',
        orderId: 'order_2026_001',
        amount: 1_000_000_001,
      }).success,
      false,
    )
  })
})

describe('zOrderCancel', () => {
  it('accepts empty / no-reason', () => {
    assert.equal(zOrderCancel.safeParse({}).success, true)
  })
  it('accepts short reason', () => {
    assert.equal(zOrderCancel.safeParse({ reason: '단순 변심' }).success, true)
  })
  it('rejects too long reason', () => {
    assert.equal(
      zOrderCancel.safeParse({ reason: 'a'.repeat(201) }).success,
      false,
    )
  })
})

describe('zPushSubscribe', () => {
  it('accepts standard PushSubscriptionJSON shape', () => {
    const result = zPushSubscribe.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123def456',
      keys: {
        p256dh: 'a-very-long-base64-key-here-must-be-at-least-20-chars',
        auth: 'auth1234',
      },
    })
    assert.equal(result.success, true)
  })
  it('rejects missing keys', () => {
    assert.equal(
      zPushSubscribe.safeParse({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      }).success,
      false,
    )
  })
  it('rejects non-https endpoint', () => {
    assert.equal(
      zPushSubscribe.safeParse({
        endpoint: 'not a url',
        keys: { p256dh: 'a'.repeat(20), auth: 'auth1234' },
      }).success,
      false,
    )
  })
})

describe('zPushUnsubscribe', () => {
  it('requires URL endpoint', () => {
    assert.equal(
      zPushUnsubscribe.safeParse({
        endpoint: 'https://example.com/push',
      }).success,
      true,
    )
    assert.equal(zPushUnsubscribe.safeParse({ endpoint: 'foo' }).success, false)
  })
})

describe('zRestockRequest', () => {
  it('accepts product UUID', () => {
    assert.equal(
      zRestockRequest.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
      true,
    )
  })
  it('accepts variantId optional + nullable', () => {
    assert.equal(
      zRestockRequest.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        variantId: null,
      }).success,
      true,
    )
  })
})

describe('zNewsletterSubscribe', () => {
  it('requires email', () => {
    assert.equal(
      zNewsletterSubscribe.safeParse({ email: 'a@b.com' }).success,
      true,
    )
    assert.equal(zNewsletterSubscribe.safeParse({}).success, false)
  })
  it('source optional', () => {
    assert.equal(
      zNewsletterSubscribe.safeParse({ email: 'a@b.com', source: 'footer' })
        .success,
      true,
    )
  })
})

describe('zAccountDelete', () => {
  it('requires confirmText literal "탈퇴"', () => {
    assert.equal(zAccountDelete.safeParse({ confirmText: '탈퇴' }).success, true)
    assert.equal(zAccountDelete.safeParse({ confirmText: 'delete' }).success, false)
    assert.equal(zAccountDelete.safeParse({ confirmText: '' }).success, false)
  })
})

describe('zNativePushRegister', () => {
  it('accepts valid iOS payload', () => {
    assert.equal(
      zNativePushRegister.safeParse({
        platform: 'ios',
        token: 'a'.repeat(64),
        deviceId: 'device-123',
        appVersion: '1.0.0',
        osVersion: '17.5',
      }).success,
      true,
    )
  })
  it('rejects invalid platform', () => {
    assert.equal(
      zNativePushRegister.safeParse({
        platform: 'web',
        token: 'a'.repeat(64),
        deviceId: 'device-123',
      }).success,
      false,
    )
  })
})
