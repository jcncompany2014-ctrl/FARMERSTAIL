/**
 * subscription-state — 구독의 '진짜 상태' 판정.
 *
 * 핵심 회귀 방지 (2026-07-15 사장님 계정 실측 사고):
 *  1. **카드 없는 구독은 절대 'active' 가 아니다.** 청구 크론이 billing_key null 을
 *     건너뛰므로 영원히 아무 일도 안 일어난다 — 그런데 화면엔 '구독 중'으로 떴고,
 *     시작도 안 한 구독에 일시정지·건너뛰기를 줘서 이상한 데이터가 생겼다.
 *  2. 결제 실패는 다른 상태보다 먼저 보여야 한다(안 그러면 배송이 조용히 멈춘다).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionState, type SubLike } from './subscription-state.ts'

function sub(over: Partial<SubLike> = {}): SubLike {
  return {
    status: 'active',
    billing_key: 'bk_1',
    next_delivery_date: '2026-08-04',
    failed_charge_count: 0,
    requires_billing_key_renewal: false,
    ...over,
  }
}

describe('subscriptionState — 카드가 없으면 시작 전이다', () => {
  it("status='active' 여도 카드가 없으면 needs_card", () => {
    assert.equal(subscriptionState(sub({ billing_key: null })), 'needs_card')
  })

  it("status='paused' 여도 카드가 없으면 needs_card (시작도 안 한 걸 '멈춤'이라 하지 않는다)", () => {
    assert.equal(
      subscriptionState(sub({ status: 'paused', billing_key: null })),
      'needs_card',
    )
  })

  it('2026-07-15 실측 케이스: paused + 카드없음 + 배송일 있음 → needs_card', () => {
    const real = sub({
      status: 'paused',
      billing_key: null,
      next_delivery_date: '2026-08-13',
    })
    assert.equal(subscriptionState(real), 'needs_card')
  })
})

describe('subscriptionState — 정상 흐름', () => {
  it('카드 있고 active → active', () => {
    assert.equal(subscriptionState(sub()), 'active')
  })

  it('카드 있고 paused → paused', () => {
    assert.equal(subscriptionState(sub({ status: 'paused' })), 'paused')
  })

  it('해지는 무엇보다 우선 (카드 없어도 cancelled)', () => {
    assert.equal(
      subscriptionState(sub({ status: 'cancelled', billing_key: null })),
      'cancelled',
    )
  })
})

describe('subscriptionState — 결제 실패가 먼저 보인다', () => {
  it('재등록 요구 플래그 → card_failed', () => {
    assert.equal(
      subscriptionState(sub({ requires_billing_key_renewal: true })),
      'card_failed',
    )
  })

  it('실패 횟수가 쌓이면 card_failed', () => {
    assert.equal(subscriptionState(sub({ failed_charge_count: 2 })), 'card_failed')
  })

  it('paused 보다 card_failed 가 우선 (멈춘 이유가 결제 실패일 수 있다)', () => {
    assert.equal(
      subscriptionState(sub({ status: 'paused', failed_charge_count: 1 })),
      'card_failed',
    )
  })

  it('해지된 건 실패가 있어도 cancelled', () => {
    assert.equal(
      subscriptionState(sub({ status: 'cancelled', failed_charge_count: 3 })),
      'cancelled',
    )
  })

  it('카드 재등록 요구는 카드 유무보다 먼저 (카드가 만료돼 지워졌을 수 있다)', () => {
    assert.equal(
      subscriptionState(
        sub({ billing_key: null, requires_billing_key_renewal: true }),
      ),
      'card_failed',
    )
  })
})
