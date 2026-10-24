import { test } from 'node:test'
import assert from 'node:assert/strict'
import { discountReasonLabel } from './discount-reason.ts'

test('discountReasonLabel: 내부 코드 대신 한글 이름, 모르는 값은 그냥 "할인"', () => {
  assert.equal(discountReasonLabel('tier'), '등급 할인')
  assert.equal(discountReasonLabel('promotion'), '프로모션 할인')
  assert.equal(discountReasonLabel('trial_cheap'), '서포터즈 할인')
  assert.equal(discountReasonLabel('trial_half'), '서포터즈 반값 할인')
  for (const v of ['none', 'something_new', '', null, undefined]) {
    assert.equal(discountReasonLabel(v as string | null | undefined), '할인', String(v))
  }
})

test('adminDiscountLabel: 어드민은 할인 종류를 구체적으로(행사=이벤트 할인, 서포터즈 단계까지), 모르는 값은 "할인"', async () => {
  const { adminDiscountLabel } = await import('./discount-reason.ts')
  assert.equal(adminDiscountLabel('promotion'), '이벤트 할인')
  assert.equal(adminDiscountLabel('trial_cheap'), '서포터즈 100원')
  assert.equal(adminDiscountLabel('trial_half'), '서포터즈 반값')
  assert.equal(adminDiscountLabel('neighbor'), '이웃 할인')
  assert.equal(adminDiscountLabel('tier'), '등급 할인')
  for (const v of ['none', 'something_new', '', null, undefined]) {
    assert.equal(adminDiscountLabel(v as string | null | undefined), '할인', String(v))
  }
})
