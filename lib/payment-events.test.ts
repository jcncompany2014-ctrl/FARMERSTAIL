/**
 * R62 — payment-events helper 단위 테스트.
 *
 * 통합 테스트 (실 DB) 가 아닌 pure logic 만 검증:
 *  - recordPaymentEvent: ok / fail 분기, 에러 throw 안 함 (best-effort)
 *  - getOrderPaymentBalance: SUM 계산 정확성
 *
 * DB trigger 가 UPDATE/DELETE 차단하는지 검증은 실 Supabase 통합 테스트
 * 영역 — 본 파일 범위 X.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  recordPaymentEvent,
  getOrderPaymentBalance,
} from './payment-events.ts'

// ─── Supabase client mock factory ───

type InsertCall = { table: string; values: Record<string, unknown> }
type SelectCall = { table: string; col: string; orderId: string }

function mockSupabase(opts: {
  insertResult?: { error: { message: string } | null }
  selectResult?: Array<{ amount: number }>
  insertThrows?: string
}) {
  const insertCalls: InsertCall[] = []
  const selectCalls: SelectCall[] = []

  const supabase = {
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          insertCalls.push({ table, values })
          if (opts.insertThrows) {
            return Promise.reject(new Error(opts.insertThrows))
          }
          return Promise.resolve(opts.insertResult ?? { error: null })
        },
        select(_cols: string) {
          return {
            eq(col: string, val: string) {
              selectCalls.push({ table, col, orderId: val })
              return Promise.resolve({
                data: opts.selectResult ?? [],
                error: null,
              })
            },
          }
        },
      }
    },
  }

  return { supabase, insertCalls, selectCalls }
}

describe('recordPaymentEvent — 정상', () => {
  it('정상 insert → ok=true', async () => {
    const { supabase, insertCalls } = mockSupabase({ insertResult: { error: null } })
    const result = await recordPaymentEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        orderId: 'ord-1',
        paymentKey: 'pmt-1',
        eventType: 'paid',
        amount: 30000,
        prevStatus: 'pending',
        newStatus: 'paid',
        source: 'user_checkout',
      },
    )
    assert.equal(result.ok, true)
    assert.equal(insertCalls.length, 1)
    assert.equal(insertCalls[0]!.table, 'payment_events')
    assert.equal(insertCalls[0]!.values.event_type, 'paid')
    assert.equal(insertCalls[0]!.values.amount, 30000)
  })

  it('환불 음수 amount 처리', async () => {
    const { supabase, insertCalls } = mockSupabase({ insertResult: { error: null } })
    await recordPaymentEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        orderId: 'ord-1',
        eventType: 'refunded',
        amount: -30000,
        prevStatus: 'paid',
        newStatus: 'cancelled',
        source: 'user_cancel',
      },
    )
    assert.equal(insertCalls[0]!.values.amount, -30000)
  })

  it('optional 필드 누락 시 null', async () => {
    const { supabase, insertCalls } = mockSupabase({ insertResult: { error: null } })
    await recordPaymentEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        orderId: 'ord-1',
        eventType: 'webhook_received',
        amount: 0,
        source: 'toss_webhook',
      },
    )
    const v = insertCalls[0]!.values
    assert.equal(v.payment_key, null)
    assert.equal(v.prev_status, null)
    assert.equal(v.new_status, null)
    assert.equal(v.metadata, null)
    assert.equal(v.actor_user_id, null)
  })
})

describe('recordPaymentEvent — best-effort 에러 처리', () => {
  it('DB error → ok=false, throw 안 함 (결제 흐름 막지 X)', async () => {
    const { supabase } = mockSupabase({
      insertResult: { error: { message: 'unique violation' } },
    })
    const result = await recordPaymentEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        orderId: 'ord-1',
        eventType: 'paid',
        amount: 30000,
        source: 'user_checkout',
      },
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'unique violation')
    }
  })

  it('network throw → ok=false, catch 함', async () => {
    const { supabase } = mockSupabase({ insertThrows: 'ECONNREFUSED' })
    const result = await recordPaymentEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        orderId: 'ord-1',
        eventType: 'paid',
        amount: 30000,
        source: 'user_checkout',
      },
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.reason, /ECONNREFUSED/)
    }
  })
})

describe('getOrderPaymentBalance', () => {
  it('빈 events → balance 0', async () => {
    const { supabase } = mockSupabase({ selectResult: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOrderPaymentBalance(supabase as any, 'ord-1')
    assert.equal(result.balance, 0)
    assert.equal(result.events, 0)
  })

  it('단일 paid event → balance = amount', async () => {
    const { supabase } = mockSupabase({ selectResult: [{ amount: 30000 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOrderPaymentBalance(supabase as any, 'ord-1')
    assert.equal(result.balance, 30000)
    assert.equal(result.events, 1)
  })

  it('paid + refunded → balance = 0 (완전 환불)', async () => {
    const { supabase } = mockSupabase({
      selectResult: [{ amount: 30000 }, { amount: -30000 }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOrderPaymentBalance(supabase as any, 'ord-1')
    assert.equal(result.balance, 0)
    assert.equal(result.events, 2)
  })

  it('paid + partial → balance = 부분 환불 후 남은 금액', async () => {
    const { supabase } = mockSupabase({
      selectResult: [
        { amount: 50000 }, // paid
        { amount: -10000 }, // 부분 환불
        { amount: -5000 }, // 또 부분 환불
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOrderPaymentBalance(supabase as any, 'ord-1')
    assert.equal(result.balance, 35000)
    assert.equal(result.events, 3)
  })
})
