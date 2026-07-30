import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkChargeAmount,
  CHARGE_AMOUNT_TOLERANCE,
} from './charge-amount-guard.ts'

/**
 * 결제 감사 critical (2026-07-29): 고객이 REST 로 `subscriptions.total_amount`
 * 를 100원으로 바꾸고 정상 박스를 받을 수 있었다. 이 검문소가 그걸 막는다.
 * 이 테스트가 깨지면 조작된 금액으로 카드가 긁힌다 — 절대 스킵 금지.
 */

test('★ 재현 케이스: 고객이 60,000원을 100원으로 낮춰놓으면 청구 거부', () => {
  const v = checkChargeAmount(100, 60000)
  assert.equal(v.verdict, 'refuse')
  if (v.verdict === 'refuse') {
    assert.equal(v.stored, 100)
    assert.equal(v.recomputed, 60000)
  }
})

test('정상 — 저장 금액과 재계산이 같으면 통과', () => {
  const v = checkChargeAmount(60000, 60000)
  assert.equal(v.verdict, 'ok')
  if (v.verdict === 'ok') assert.equal(v.chargeBase, 60000)
})

test('반올림 오차(허용치 이내)는 정상으로 통과', () => {
  const v = checkChargeAmount(60000 - CHARGE_AMOUNT_TOLERANCE, 60000)
  assert.equal(v.verdict, 'ok')
})

test('허용치를 1원이라도 넘게 낮으면 거부', () => {
  const v = checkChargeAmount(60000 - CHARGE_AMOUNT_TOLERANCE - 1, 60000)
  assert.equal(v.verdict, 'refuse')
})

test('★ 저장 금액이 더 크면 재계산값으로 낮춰 청구 — 과청구 금지', () => {
  const v = checkChargeAmount(99000, 60000)
  assert.equal(v.verdict, 'ok')
  if (v.verdict === 'ok') assert.equal(v.chargeBase, 60000)
})

test('0원·음수 저장 금액은 거부 (그 자체로 비정상)', () => {
  assert.equal(checkChargeAmount(0, 60000).verdict, 'refuse')
  assert.equal(checkChargeAmount(-5000, 60000).verdict, 'refuse')
})

test('재계산 불가면 검사를 건너뛴다 — 돈을 추측하지 않는다', () => {
  // 처방·화식비율·제품이 없으면 근거가 없다. 기존 동작(저장 금액 청구) 유지.
  assert.equal(checkChargeAmount(60000, null).verdict, 'skip-check')
  assert.equal(checkChargeAmount(60000, 0).verdict, 'skip-check')
})
