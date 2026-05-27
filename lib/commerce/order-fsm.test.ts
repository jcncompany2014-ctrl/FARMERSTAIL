import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isOrderStatus,
  isPaymentStatus,
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  nextOrderStatuses,
  isTerminalOrderStatus,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
} from './order-fsm.ts'

/**
 * order-fsm.ts — 주문 / 결제 상태 FSM 회귀 가드.
 *
 * 핵심 invariants:
 *  - delivered / cancelled 는 terminal (관리자도 못 풀음 — 환불은 별도)
 *  - customer 는 pending/preparing 까지만 self-cancel
 *  - 결제 미완 (payment_status !== 'paid') → shipping/delivered 차단
 *  - shipping → preparing 역행은 admin only
 *  - paid → cancelled 만 결제 환불 정상 경로
 */

describe('isOrderStatus / isPaymentStatus', () => {
  it('알려진 order 상태 → true', () => {
    for (const s of ORDER_STATUSES) {
      assert.ok(isOrderStatus(s))
    }
  })

  it('알려진 payment 상태 → true', () => {
    for (const s of PAYMENT_STATUSES) {
      assert.ok(isPaymentStatus(s))
    }
  })

  it('알 수 없는 문자열 → false', () => {
    assert.equal(isOrderStatus('unknown'), false)
    assert.equal(isOrderStatus('PAID'), false) // case-sensitive
    // R83-1: 'refunded' / 'partially_refunded' 가 enum 에 추가됐으므로 알려진 값.
    assert.equal(isPaymentStatus('unknown_status'), false)
    assert.equal(isPaymentStatus('PARTIALLY_REFUNDED'), false) // case-sensitive
  })

  it('non-string → false', () => {
    assert.equal(isOrderStatus(null), false)
    assert.equal(isOrderStatus(undefined), false)
    assert.equal(isOrderStatus(0), false)
    assert.equal(isPaymentStatus({}), false)
  })
})

describe('canTransitionOrderStatus — terminal 보호', () => {
  it('delivered 는 어떤 actor 도 변경 불가', () => {
    for (const actor of ['admin', 'customer', 'system'] as const) {
      const res = canTransitionOrderStatus('delivered', 'cancelled', {
        actor,
        payment_status: 'paid',
      })
      assert.equal(res.ok, false)
    }
  })

  it('cancelled 는 어떤 actor 도 되돌릴 수 없음', () => {
    for (const actor of ['admin', 'customer', 'system'] as const) {
      const res = canTransitionOrderStatus('cancelled', 'preparing', {
        actor,
        payment_status: 'cancelled',
      })
      assert.equal(res.ok, false)
    }
  })

  it('같은 상태로의 전환은 거부 (no-op)', () => {
    const res = canTransitionOrderStatus('preparing', 'preparing', {
      actor: 'admin',
      payment_status: 'paid',
    })
    assert.equal(res.ok, false)
  })
})

describe('canTransitionOrderStatus — customer self-cancel', () => {
  it('pending → cancelled OK', () => {
    const res = canTransitionOrderStatus('pending', 'cancelled', {
      actor: 'customer',
      payment_status: 'pending',
    })
    assert.equal(res.ok, true)
  })

  it('preparing → cancelled OK', () => {
    const res = canTransitionOrderStatus('preparing', 'cancelled', {
      actor: 'customer',
      payment_status: 'paid',
    })
    assert.equal(res.ok, true)
  })

  it('shipping → cancelled 차단 (배송 이미 시작)', () => {
    const res = canTransitionOrderStatus('shipping', 'cancelled', {
      actor: 'customer',
      payment_status: 'paid',
    })
    assert.equal(res.ok, false)
  })

  it('customer 는 cancel 외 다른 전환 불가', () => {
    const res = canTransitionOrderStatus('preparing', 'shipping', {
      actor: 'customer',
      payment_status: 'paid',
    })
    assert.equal(res.ok, false)
  })
})

describe('canTransitionOrderStatus — admin 정방향', () => {
  it('pending → preparing (수기 입금 확인 등)', () => {
    assert.equal(
      canTransitionOrderStatus('pending', 'preparing', {
        actor: 'admin',
        payment_status: 'paid',
      }).ok,
      true,
    )
  })

  it('preparing → shipping', () => {
    assert.equal(
      canTransitionOrderStatus('preparing', 'shipping', {
        actor: 'admin',
        payment_status: 'paid',
      }).ok,
      true,
    )
  })

  it('preparing → delivered (즉시 수령 등 드문 케이스)', () => {
    assert.equal(
      canTransitionOrderStatus('preparing', 'delivered', {
        actor: 'admin',
        payment_status: 'paid',
      }).ok,
      true,
    )
  })

  it('shipping → delivered', () => {
    assert.equal(
      canTransitionOrderStatus('shipping', 'delivered', {
        actor: 'admin',
        payment_status: 'paid',
      }).ok,
      true,
    )
  })

  it('shipping → preparing 역행 admin only', () => {
    assert.equal(
      canTransitionOrderStatus('shipping', 'preparing', {
        actor: 'admin',
        payment_status: 'paid',
      }).ok,
      true,
    )
    // customer 는 cancel 외 불가라 false
    assert.equal(
      canTransitionOrderStatus('shipping', 'preparing', {
        actor: 'customer',
        payment_status: 'paid',
      }).ok,
      false,
    )
  })
})

describe('canTransitionOrderStatus — 결제 가드', () => {
  it('결제 미완 + → shipping 차단', () => {
    const res = canTransitionOrderStatus('preparing', 'shipping', {
      actor: 'admin',
      payment_status: 'pending',
    })
    assert.equal(res.ok, false)
  })

  it('결제 실패 + → delivered 차단', () => {
    const res = canTransitionOrderStatus('preparing', 'delivered', {
      actor: 'admin',
      payment_status: 'failed',
    })
    assert.equal(res.ok, false)
  })

  it('cancelled (환불) 상태도 shipping/delivered 차단', () => {
    const res = canTransitionOrderStatus('preparing', 'shipping', {
      actor: 'admin',
      payment_status: 'cancelled',
    })
    assert.equal(res.ok, false)
  })

  it('preparing → cancelled 는 결제 상태 무관 (환불은 별도)', () => {
    const res = canTransitionOrderStatus('preparing', 'cancelled', {
      actor: 'admin',
      payment_status: 'pending',
    })
    assert.equal(res.ok, true)
  })
})

describe('nextOrderStatuses', () => {
  it('pending — admin 은 preparing + cancelled', () => {
    const opts = nextOrderStatuses('pending', {
      actor: 'admin',
      payment_status: 'paid',
    })
    assert.ok(opts.includes('preparing'))
    assert.ok(opts.includes('cancelled'))
    assert.ok(!opts.includes('pending'))
    assert.ok(!opts.includes('shipping')) // 정방향 점프 X
  })

  it('shipping — admin 은 delivered + preparing(역행) + cancelled', () => {
    const opts = nextOrderStatuses('shipping', {
      actor: 'admin',
      payment_status: 'paid',
    })
    assert.ok(opts.includes('delivered'))
    assert.ok(opts.includes('preparing'))
    assert.ok(opts.includes('cancelled'))
  })

  it('customer 는 cancel 만 노출', () => {
    const opts = nextOrderStatuses('preparing', {
      actor: 'customer',
      payment_status: 'paid',
    })
    assert.deepEqual(opts, ['cancelled'])
  })

  it('terminal 에서는 빈 배열', () => {
    assert.deepEqual(
      nextOrderStatuses('delivered', {
        actor: 'admin',
        payment_status: 'paid',
      }),
      [],
    )
    assert.deepEqual(
      nextOrderStatuses('cancelled', {
        actor: 'admin',
        payment_status: 'cancelled',
      }),
      [],
    )
  })
})

describe('isTerminalOrderStatus', () => {
  it('delivered / cancelled → true', () => {
    assert.equal(isTerminalOrderStatus('delivered'), true)
    assert.equal(isTerminalOrderStatus('cancelled'), true)
  })

  it('pending / preparing / shipping → false', () => {
    assert.equal(isTerminalOrderStatus('pending'), false)
    assert.equal(isTerminalOrderStatus('preparing'), false)
    assert.equal(isTerminalOrderStatus('shipping'), false)
  })
})

describe('canTransitionPaymentStatus', () => {
  it('같은 상태 거부', () => {
    assert.equal(canTransitionPaymentStatus('paid', 'paid').ok, false)
  })

  it('pending → 어떤 상태든 허용 (결제 시도 결과)', () => {
    assert.equal(canTransitionPaymentStatus('pending', 'paid').ok, true)
    assert.equal(canTransitionPaymentStatus('pending', 'failed').ok, true)
    assert.equal(canTransitionPaymentStatus('pending', 'cancelled').ok, true)
  })

  it('paid → cancelled (환불) 정상 경로', () => {
    assert.equal(canTransitionPaymentStatus('paid', 'cancelled').ok, true)
  })

  it('paid → failed 차단 (이미 성공한 결제)', () => {
    assert.equal(canTransitionPaymentStatus('paid', 'failed').ok, false)
  })

  it('failed → pending 차단 (재시도는 새 주문 패턴)', () => {
    assert.equal(canTransitionPaymentStatus('failed', 'pending').ok, false)
  })

  it('cancelled (환불) 은 terminal', () => {
    assert.equal(canTransitionPaymentStatus('cancelled', 'paid').ok, false)
    assert.equal(canTransitionPaymentStatus('cancelled', 'pending').ok, false)
  })
})
