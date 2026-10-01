import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLiveTrial, supporterViews } from './trial-display.ts'

const T = (cheap: number, half: number) => ({ cheap_remaining: cheap, half_remaining: half, cheap_price: 100, half_rate: 0.5 })

test('서포터즈 구독은 정가가 아니라 실제 다음 결제 금액 (땅콩 51,500원 → 100원)', () => {
  const subs = [{ id: 's1', user_id: 'u1', status: 'active', next_delivery_date: '2026-10-06', total_amount: 51500 }]
  const v = supporterViews(subs, new Map([['u1', T(4, 4)]])).get('s1')
  assert.ok(v)
  assert.equal(v.chargeAmount, 100)
  assert.equal(v.listAmount, 51500)
  assert.equal(v.daysLeft, 56)
  assert.equal(v.caption, '서포터즈 100원 구간 · 56일치 남음')
})

test('반값 구간 · 서포터즈 아닌 고객 · 해지 구독은 표시 없음', () => {
  const subs = [
    { id: 'a', user_id: 'u1', status: 'active', next_delivery_date: '2026-10-06', total_amount: 51500 },
    { id: 'b', user_id: 'u2', status: 'active', next_delivery_date: '2026-10-06', total_amount: 40000 },
    { id: 'c', user_id: 'u3', status: 'cancelled', next_delivery_date: null, total_amount: 40000 },
  ]
  const m = supporterViews(subs, new Map([['u1', T(0, 2)], ['u3', T(4, 4)]]))
  assert.equal(m.get('a')?.chargeAmount, 25750)
  assert.equal(m.get('a')?.caption, '서포터즈 반값 구간 · 28일치 남음')
  assert.equal(m.has('b'), false)
  assert.equal(m.has('c'), false)
  assert.equal(isLiveTrial(T(0, 0)), false)
})

test('한 사람이 두 마리 — 청구 순서상 두 번째 구독은 한 회차를 쓴 뒤의 가격', () => {
  const subs = [
    { id: 'late', user_id: 'u1', status: 'active', next_delivery_date: '2026-10-13', total_amount: 30000 },
    { id: 'early', user_id: 'u1', status: 'active', next_delivery_date: '2026-10-06', total_amount: 50000 },
  ]
  const m = supporterViews(subs, new Map([['u1', T(1, 4)]]))
  assert.equal(m.get('early')?.chargeAmount, 100)
  assert.equal(m.get('late')?.phase, 'half')
  assert.equal(m.get('late')?.chargeAmount, 15000)
})
