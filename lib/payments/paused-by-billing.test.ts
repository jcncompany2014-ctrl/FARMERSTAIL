import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPausedByBillingFailure,
  MAX_FAILED_CHARGES,
} from './billing-error-classify.ts'

/**
 * 카드 재등록 시 자동 재개 판정 (2026-08-07 고객 실패경로 감사).
 *
 * 메일·화면이 "카드를 다시 등록하면 자동으로 다시 시작돼요" 라고 약속하는데,
 * 예전 판정은 `requires_billing_key_renewal === true` 만 봤다. 그 플래그는
 * permanent(카드 만료)에서만 켜지므로, **원인 불명 3회 실패로 멈춘 구독은
 * 카드를 다시 넣어도 재개되지 않았다** — 시킨 대로 다 했는데 박스가 안 온다.
 */

test('카드 만료(영구 거절)로 멈춘 구독은 재개 대상', () => {
  assert.equal(
    isPausedByBillingFailure({
      status: 'paused',
      requires_billing_key_renewal: true,
      failed_charge_count: 1,
    }),
    true,
  )
})

test('★원인 불명 3-strike 로 멈춘 구독도 재개 대상 (예전엔 아니었다)', () => {
  assert.equal(
    isPausedByBillingFailure({
      status: 'paused',
      requires_billing_key_renewal: false,
      failed_charge_count: MAX_FAILED_CHARGES,
    }),
    true,
  )
})

test('고객이 스스로 누른 일시정지는 재개하지 않는다', () => {
  assert.equal(
    isPausedByBillingFailure({
      status: 'paused',
      requires_billing_key_renewal: false,
      failed_charge_count: 0,
    }),
    false,
  )
  // 실패가 쌓였지만 아직 3회 미만인데 본인이 멈춘 경우도 마찬가지.
  assert.equal(
    isPausedByBillingFailure({
      status: 'paused',
      requires_billing_key_renewal: false,
      failed_charge_count: MAX_FAILED_CHARGES - 1,
    }),
    false,
  )
})

test('paused 가 아니면 재개 판정 자체가 아니다', () => {
  for (const status of ['active', 'cancelled', undefined, null]) {
    assert.equal(
      isPausedByBillingFailure({
        status: status as string | null | undefined,
        requires_billing_key_renewal: true,
        failed_charge_count: 99,
      }),
      false,
      `status=${String(status)}`,
    )
  }
})

test('failed_charge_count 가 없으면(select 누락) 3-strike 로 오인하지 않는다', () => {
  // 조회에서 컬럼을 빠뜨리면 undefined 가 온다 — 그걸 0 으로 읽어 재개하지
  // 않는 쪽이 안전하다(멋대로 재개하는 것보다 낫다).
  assert.equal(
    isPausedByBillingFailure({
      status: 'paused',
      requires_billing_key_renewal: false,
    }),
    false,
  )
})
