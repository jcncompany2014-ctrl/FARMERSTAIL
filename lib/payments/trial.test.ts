/**
 * 체험단 3단 가격 판정 — 돈이 걸린 순수 함수라 경계 전부 고정.
 * (100원 하한은 카드 최소금액 사고(결제감사 #7)의 코드측 방어이기도 하다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { trialPricing, type TrialState } from './trial.ts'

const base = (over: Partial<TrialState> = {}): TrialState => ({
  cheap_remaining: 4,
  half_remaining: 4,
  cheap_price: 100,
  half_rate: 0.5,
  ...over,
})

describe('체험단 3단 가격', () => {
  it('① 100원 구간: 산출가와 무관하게 100원 고정', () => {
    const p = trialPricing(base(), 31620)
    assert.equal(p?.phase, 'cheap')
    assert.equal(p?.chargeAmount, 100)
    assert.equal(p?.discountAmount, 31520)
    assert.equal(p?.remaining, 4)
  })

  it('② 반값 구간: 자기 산출가의 50% (사장님 지적 반영 — 고정 금액 아님)', () => {
    const s = base({ cheap_remaining: 0 })
    assert.equal(trialPricing(s, 31620)?.chargeAmount, 15810)
    assert.equal(trialPricing(s, 60000)?.chargeAmount, 30000) // 큰 아이는 큰 아이대로
    assert.equal(trialPricing(s, 31620)?.phase, 'half')
  })

  it('③ 둘 다 소진되면 null — 평소 규칙(등급·프로모션)으로 복귀', () => {
    assert.equal(trialPricing(base({ cheap_remaining: 0, half_remaining: 0 }), 31620), null)
  })

  it('체험 아님(null) 은 null', () => {
    assert.equal(trialPricing(null, 31620), null)
  })

  it('100원 하한: 반값이 100원 밑으로 내려가지 않는다 (카드 최소금액)', () => {
    const s = base({ cheap_remaining: 0 })
    assert.equal(trialPricing(s, 150)?.chargeAmount, 100)
  })

  it('역전 금지: 산출가가 체험가보다 싸면 산출가 그대로', () => {
    assert.equal(trialPricing(base({ cheap_price: 500 }), 300)?.chargeAmount, 300)
  })

  it('0원 절대 불가: 어떤 조합에서도 chargeAmount > 0 (결제 크론 0원 스킵과 무충돌)', () => {
    for (const subtotal of [100, 101, 1000, 31620, 153100])
      for (const s of [base(), base({ cheap_remaining: 0 }), base({ cheap_remaining: 0, half_rate: 0.99 })]) {
        const p = trialPricing(s, subtotal)
        if (p) assert.ok(p.chargeAmount > 0 && p.chargeAmount <= subtotal, `${subtotal} → ${p.chargeAmount}`)
      }
  })

  it('회차 우선순위: cheap 이 남아있으면 half 를 먼저 쓰지 않는다', () => {
    assert.equal(trialPricing(base({ cheap_remaining: 1 }), 31620)?.phase, 'cheap')
  })
})
