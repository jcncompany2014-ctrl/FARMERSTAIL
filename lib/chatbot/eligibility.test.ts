import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canUseChatbot } from './eligibility.ts'

const base = {
  next_delivery_date: '2026-10-20',
  failed_charge_count: 0,
  requires_billing_key_renewal: false,
  has_billing_key: true,
}

test('정기배송 중(active)·잠시 멈춤(paused)이면 쓸 수 있다', () => {
  assert.equal(canUseChatbot([{ ...base, status: 'active' as const }]), true)
  assert.equal(canUseChatbot([{ ...base, status: 'paused' as const }]), true)
})

test('카드 미등록·결제 실패·해지·구독 없음은 쓸 수 없다', () => {
  assert.equal(canUseChatbot([]), false)
  assert.equal(canUseChatbot([{ ...base, status: 'active' as const, has_billing_key: false }]), false)
  assert.equal(canUseChatbot([{ ...base, status: 'active' as const, requires_billing_key_renewal: true }]), false)
  assert.equal(canUseChatbot([{ ...base, status: 'active' as const, failed_charge_count: 1 }]), false)
  assert.equal(canUseChatbot([{ ...base, status: 'cancelled' as const }]), false)
})

test('여러 구독 중 하나라도 정기배송 중이면 쓸 수 있다', () => {
  assert.equal(
    canUseChatbot([
      { ...base, status: 'cancelled' as const },
      { ...base, status: 'paused' as const },
    ]),
    true,
  )
})
