/**
 * lib/payments/ambiguous-charges — 결과 불명 자동결제 확정 (2026-09-28 출시 전 점검 9차).
 *
 * 가짜 Supabase(메모리 표 + 필터 해석)와 가짜 토스 조회로 12가지 상황을 실제로 돌린다. 핵심 불변식:
 *   · 토스에서 결제됐는데 우리 기록이 실패면 → 그 구독은 청구하지 않는다(미확정 가드로 막고 경보)
 *   · 결제 안 된 게 확정되면 → 새 멱등키(charge_key_seq+1)로 정상 청구
 *   · 모르면(조회 실패·진행 중) → 청구하지 않는다
 *   · 키가 틀리면(UNAUTHORIZED_KEY) → 실행 전체를 멈춘다
 * (실제 PostgREST 필터 문법은 2026-09-28 운영 DB 읽기 전용 조회로 파싱 확인 — 틀린 문법은 오류가 나는 것도 확인.)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyAmbiguousCharges, type AmbiguousDeps } from './ambiguous-charges.ts'
import type { TossPayment } from './toss.ts'

type Row = Record<string, unknown>

// ── 가짜 Supabase — 크론이 쓰는 체인만 ──────────────────────────────────────────────
function makeDb(tables: Record<string, Row[]>, opts: { failScan?: boolean } = {}) {
  type Cond = (r: Row) => boolean
  const parseOr = (expr: string): Cond => {
    // "and(a.eq.x,b.is.null),and(...)" — 최상위 콤마로 가르고 각 and(...) 안을 다시 가른다
    const groups: string[] = []
    let depth = 0
    let cur = ''
    for (const ch of expr) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        groups.push(cur)
        cur = ''
      } else cur += ch
    }
    if (cur) groups.push(cur)
    const conds = groups.map((g) => {
      const inner = g.replace(/^and\(/, '').replace(/\)$/, '')
      const parts = inner.split(',').map((c) => {
        const p = c.split('.')
        const col = p[0]!
        const neg = p[1] === 'not'
        const op = neg ? p[2]! : p[1]!
        const val = (neg ? p.slice(3) : p.slice(2)).join('.')
        const f: Cond = (r) => {
          const v = r[col]
          let ok: boolean
          if (op === 'eq') ok = String(v) === val
          else if (op === 'is') ok = val === 'null' ? v == null : false
          else if (op === 'lt') ok = String(v) < val
          else throw new Error('op ' + op)
          return neg ? !ok : ok
        }
        return f
      })
      return (r: Row) => parts.every((f) => f(r))
    })
    return (r) => conds.some((c) => c(r))
  }
  const from = (table: string) => {
    const rows = tables[table] ?? []
    const filters: Cond[] = []
    let mode: 'select' | 'update' = 'select'
    let patch: Row = {}
    let lim = Infinity
    let single = false
    const b = {
      select() { mode = mode === 'update' ? 'update' : 'select'; return b },
      update(p: Row) { mode = 'update'; patch = p; return b },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return b },
      in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return b },
      gte(c: string, v: string) { filters.push((r) => String(r[c]) >= v); return b },
      not(c: string, _op: string, _v: null) { filters.push((r) => r[c] != null); return b },
      or(expr: string) { filters.push(parseOr(expr)); return b },
      order() { return b },
      limit(n: number) { lim = n; return b },
      maybeSingle() { single = true; return b },
      then(res: (v: unknown) => void) {
        if (opts.failScan && table === 'subscription_charges' && mode === 'select') {
          return res({ data: null, error: { message: 'boom' } })
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)))
        if (mode === 'update') {
          for (const r of hit) Object.assign(r, patch)
          return res({ data: hit, error: null })
        }
        const out = hit.slice(0, lim)
        return res({ data: single ? (out[0] ?? null) : out, error: null })
      },
    }
    return b
  }
  return { from } as never
}

const OLD = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3시간 전
const FRESH = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5분 전

function charge(p: Partial<Row>): Row {
  return {
    id: 'c1', subscription_id: 's1', order_id: 'o1', status: 'failed', error_code: 'NETWORK_ERROR',
    payment_key: null, toss_verified_at: null, attempted_at: OLD, ...p,
  }
}
const pay = (status: TossPayment['status'], paymentKey = 'pk_1'): TossPayment =>
  ({ paymentKey, orderId: 'FT-1', status, totalAmount: 32700 }) as TossPayment

function deps(result: Awaited<ReturnType<AmbiguousDeps['lookup']>>) {
  const calls: string[] = []
  const reports: string[] = []
  const d: AmbiguousDeps = {
    lookup: async (orderId) => { calls.push(orderId); return result },
    report: (_l, m) => { reports.push(m) },
  }
  return { d, calls, reports }
}

function tables(c: Row, extraOrders: Row[] = []) {
  return {
    subscription_charges: [c],
    orders: [{ id: 'o1', order_number: 'FT-1', payment_key: null }, ...extraOrders],
    subscriptions: [{ id: 's1', charge_key_seq: 0 }],
  }
}

test('① 결과 불명 실패 + 토스 DONE(우리 기록 없음) → 미확정으로 되돌리고 그 구독 청구 금지 + 경보', async () => {
  const t = tables(charge({}))
  const { d, reports } = deps({ found: true, payment: pay('DONE') })
  const r = await verifyAmbiguousCharges(makeDb(t), d)
  const c = t.subscription_charges[0]!
  assert.equal(c.status, 'pending')
  assert.equal(c.payment_key, 'pk_1')
  assert.ok(c.toss_verified_at)
  assert.ok(r.unresolvedSubIds.has('s1'))
  assert.equal(r.held, 1)
  assert.ok(reports.includes('subscription.charge.ambiguous_captured'))
  assert.equal(t.subscriptions[0]!.charge_key_seq, 0, '결제됐는데 키를 올리면 안 된다')
})

test('② 결과 불명 + 토스 NOT_FOUND → 확인 표시 + 멱등키 앵커 +1, 청구 허용', async () => {
  const t = tables(charge({}))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: false }).d)
  assert.ok(t.subscription_charges[0]!.toss_verified_at)
  assert.equal(t.subscription_charges[0]!.status, 'failed')
  assert.equal(t.subscriptions[0]!.charge_key_seq, 1)
  assert.equal(r.unresolvedSubIds.size, 0)
})

test('③ 결과 불명 + 토스 ABORTED → 결제 없음과 같다', async () => {
  const t = tables(charge({ error_code: 'FAILED_INTERNAL_SYSTEM_PROCESSING' }))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: true, payment: pay('ABORTED') }).d)
  assert.equal(t.subscriptions[0]!.charge_key_seq, 1)
  assert.equal(r.unresolvedSubIds.size, 0)
})

test('④ 조회 실패(타임아웃) → 모른다 → 그 구독 청구 금지, 행은 그대로', async () => {
  const t = tables(charge({}))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: null, error: { code: 'TOSS_TIMEOUT', message: 'x' } }).d)
  assert.ok(r.unresolvedSubIds.has('s1'))
  assert.equal(t.subscription_charges[0]!.toss_verified_at, null)
  assert.equal(r.abort, null)
})

test('⑤ 조회가 UNAUTHORIZED_KEY → 실행 전체 중단', async () => {
  const t = tables(charge({}))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: null, error: { code: 'UNAUTHORIZED_KEY', message: 'x' } }).d)
  assert.equal(r.abort, 'toss_unauthorized')
})

test('⑥ 확정 거절(잔액부족)은 조회 없이 확인 표시만', async () => {
  const t = tables(charge({ error_code: 'REJECT_CARD_PAYMENT' }))
  const { d, calls } = deps({ found: true, payment: pay('DONE') })
  const r = await verifyAmbiguousCharges(makeDb(t), d)
  assert.equal(calls.length, 0)
  assert.ok(t.subscription_charges[0]!.toss_verified_at)
  assert.equal(r.unresolvedSubIds.size, 0)
})

test('⑦ 멱등키 재생 성공이 이미 다른 주문에 기록됨 → 문제 없음(막지 않는다)', async () => {
  const t = tables(charge({}), [{ id: 'o2', order_number: 'FT-2', payment_key: 'pk_1' }])
  const { d, reports } = deps({ found: true, payment: pay('DONE') })
  const r = await verifyAmbiguousCharges(makeDb(t), d)
  assert.equal(t.subscription_charges[0]!.status, 'failed')
  assert.ok(t.subscription_charges[0]!.toss_verified_at)
  assert.equal(r.unresolvedSubIds.size, 0)
  assert.ok(!reports.includes('subscription.charge.ambiguous_captured'))
})

test('⑧ 앞서 결제됨으로 되돌린 행 + 토스에서 환불(CANCELED) → 가드를 푼다', async () => {
  const t = tables(charge({ status: 'pending', payment_key: 'pk_1', toss_verified_at: OLD }))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: true, payment: pay('CANCELED') }).d)
  assert.equal(t.subscription_charges[0]!.status, 'failed')
  assert.equal(r.released, 1)
})

test('⑨ 청구 도중 끊긴 진행 중 행(1시간+) + 토스 DONE → 결제키를 붙여 가드가 막게', async () => {
  const t = tables(charge({ status: 'pending', error_code: null }))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: true, payment: pay('DONE') }).d)
  assert.equal(t.subscription_charges[0]!.status, 'pending')
  assert.equal(t.subscription_charges[0]!.payment_key, 'pk_1')
  assert.ok(r.unresolvedSubIds.has('s1'))
})

test('⑨′ 끊긴 진행 중 행 + 토스 없음 → 실패로 닫는다', async () => {
  const t = tables(charge({ status: 'pending', error_code: null }))
  await verifyAmbiguousCharges(makeDb(t), deps({ found: false }).d)
  assert.equal(t.subscription_charges[0]!.status, 'failed')
  assert.equal(t.subscription_charges[0]!.error_code, 'INTERRUPTED_NOT_CHARGED')
})

test('⑩ 방금 시작한 진행 중 행(5분)은 건드리지 않는다 — 지금 실행과 겹침 방지', async () => {
  const t = tables(charge({ status: 'pending', error_code: null, attempted_at: FRESH }))
  const { d, calls } = deps({ found: false })
  await verifyAmbiguousCharges(makeDb(t), d)
  assert.equal(calls.length, 0)
  assert.equal(t.subscription_charges[0]!.status, 'pending')
})

test('⑪ 토스가 아직 진행 중(IN_PROGRESS) → 모른다 → 청구 금지', async () => {
  const t = tables(charge({}))
  const r = await verifyAmbiguousCharges(makeDb(t), deps({ found: true, payment: pay('IN_PROGRESS') }).d)
  assert.ok(r.unresolvedSubIds.has('s1'))
  assert.equal(t.subscription_charges[0]!.toss_verified_at, null)
})

test('⑫ 스캔 조회 자체가 실패 → 실행 중단(어느 구독이 위험한지 모른다)', async () => {
  const t = tables(charge({}))
  const r = await verifyAmbiguousCharges(makeDb(t, { failScan: true }), deps({ found: false }).d)
  assert.equal(r.abort, 'ambiguous_lookup_failed')
})
