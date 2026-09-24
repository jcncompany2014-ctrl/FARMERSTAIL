import { test } from 'node:test'
import assert from 'node:assert/strict'
import { discountReasonLabel } from './discount-reason.ts'

test('discountReasonLabel: 내부 코드 대신 한글 이름, 모르는 값은 그냥 "할인"', () => {
  assert.equal(discountReasonLabel('tier'), '등급 할인')
  assert.equal(discountReasonLabel('promotion'), '프로모션 할인')
  assert.equal(discountReasonLabel('trial_cheap'), '체험단 할인')
  assert.equal(discountReasonLabel('trial_half'), '체험단 반값 할인')
  for (const v of ['none', 'something_new', '', null, undefined]) {
    assert.equal(discountReasonLabel(v as string | null | undefined), '할인', String(v))
  }
})
