import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendLedger,
  creditPoints,
  debitPoints,
  getCurrentBalance,
} from './points.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * [D8] points.ts — Supabase RPC wrapper. mock client 로 입력 검증 / 반환 모양.
 */

function makeMockSupabase(opts: {
  rpcResult?: unknown
  rpcError?: { message: string } | null
  balance?: number
}): SupabaseClient {
  const balance = opts.balance ?? 0
  return {
    rpc: async () => ({
      data: opts.rpcResult ?? null,
      error: opts.rpcError ?? null,
    }),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: balance > 0 ? { balance_after: balance } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('getCurrentBalance', () => {
  it('row 없으면 0', async () => {
    const sb = makeMockSupabase({ balance: 0 })
    const b = await getCurrentBalance(sb, 'user-1')
    assert.equal(b, 0)
  })

  it('row 있으면 balance_after 반환', async () => {
    const sb = makeMockSupabase({ balance: 5000 })
    const b = await getCurrentBalance(sb, 'user-1')
    assert.equal(b, 5000)
  })
})

describe('appendLedger', () => {
  it('RPC 성공 시 ok=true + balanceAfter', async () => {
    const sb = makeMockSupabase({
      rpcResult: [{ balance_after: 1500, ok: true, message: null }],
    })
    const r = await appendLedger(sb, {
      userId: 'user-1',
      delta: 500,
      reason: 'test',
      referenceType: 'signup_bonus',
      referenceId: null,
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.balanceAfter, 1500)
  })

  it('RPC 에러 시 ok=false + reason', async () => {
    const sb = makeMockSupabase({
      rpcResult: null,
      rpcError: { message: 'lock timeout' },
    })
    const r = await appendLedger(sb, {
      userId: 'user-1',
      delta: 500,
      reason: 'test',
      referenceType: 'signup_bonus',
      referenceId: null,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.reason, /lock/)
  })

  it('RPC row 가 ok=false 반환 → fail', async () => {
    const sb = makeMockSupabase({
      rpcResult: [{ balance_after: 0, ok: false, message: '잔액 부족' }],
    })
    const r = await appendLedger(sb, {
      userId: 'user-1',
      delta: -1000,
      reason: 'use',
      referenceType: 'order',
      referenceId: null,
    })
    assert.equal(r.ok, false)
  })
})

describe('creditPoints', () => {
  it('amount > 0 → appendLedger 호출', async () => {
    const sb = makeMockSupabase({
      rpcResult: [{ balance_after: 1000, ok: true }],
    })
    const r = await creditPoints(sb, {
      userId: 'user-1',
      amount: 1000,
      reason: '가입',
      referenceType: 'signup_bonus',
      referenceId: null,
    })
    assert.equal(r.ok, true)
  })

  it('amount <= 0 → 거부', async () => {
    const sb = makeMockSupabase({})
    const r = await creditPoints(sb, {
      userId: 'user-1',
      amount: 0,
      reason: '잘못',
      referenceType: 'admin_adjustment',
      referenceId: null,
    })
    assert.equal(r.ok, false)
  })
})

describe('debitPoints', () => {
  it('잔액 부족 → 거부 + 적립 시도 X', async () => {
    const sb = makeMockSupabase({ balance: 100 })
    const r = await debitPoints(sb, {
      userId: 'user-1',
      amount: 500,
      reason: '주문',
      referenceType: 'order',
      referenceId: null,
    })
    assert.equal(r.ok, false)
  })

  it('amount <= 0 → 거부', async () => {
    const sb = makeMockSupabase({})
    const r = await debitPoints(sb, {
      userId: 'user-1',
      amount: -10,
      reason: '잘못',
      referenceType: 'order',
      referenceId: null,
    })
    assert.equal(r.ok, false)
  })

  it('잔액 충분 → appendLedger 호출 (negative delta)', async () => {
    const sb = makeMockSupabase({
      balance: 5000,
      rpcResult: [{ balance_after: 4000, ok: true }],
    })
    const r = await debitPoints(sb, {
      userId: 'user-1',
      amount: 1000,
      reason: '주문',
      referenceType: 'order',
      referenceId: null,
    })
    assert.equal(r.ok, true)
  })
})
