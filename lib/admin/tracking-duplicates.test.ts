import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duplicateTrackingMessage, findTrackingDuplicates } from './tracking-duplicates.ts'

test('경고 문구: 주문번호 3개까지, 나머지는 외 n건', () => {
  assert.match(duplicateTrackingMessage(['A1']), /다른 주문\(A1\)/)
  assert.match(duplicateTrackingMessage(['A1', 'A2', 'A3', 'A4', 'A5']), /A1, A2, A3 외 2건/)
})

/** 쿼리 사슬을 흉내 내는 가짜 클라이언트 — 마지막 limit 이 결과를 돌려준다. */
function fakeClient(result: { data: unknown[] | null; error: { message: string } | null }, seen: string[]) {
  const chain = {
    select: (c: string) => (seen.push(`select:${c}`), chain),
    eq: (c: string, v: string) => (seen.push(`eq:${c}=${v}`), chain),
    neq: (c: string, v: string) => (seen.push(`neq:${c}=${v}`), chain),
    limit: async () => result,
  }
  return { from: (t: string) => (seen.push(`from:${t}`), chain) }
}

test('같은 택배사·번호의 **다른** 주문을 찾는다', async () => {
  const seen: string[] = []
  const r = await findTrackingDuplicates(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fakeClient({ data: [{ order_number: 'FT-1' }], error: null }, seen) as any,
    { orderId: 'o1', carrier: 'cj', trackingNumber: '123' },
  )
  assert.deepEqual(r, { orderNumbers: ['FT-1'], error: null })
  assert.ok(seen.includes('eq:carrier=cj') && seen.includes('eq:tracking_number=123') && seen.includes('neq:id=o1'))
})

test('조회 실패는 오류로 돌려준다(중복 없음으로 접지 않는다)', async () => {
  const r = await findTrackingDuplicates(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fakeClient({ data: null, error: { message: 'boom' } }, []) as any,
    { orderId: 'o1', carrier: 'cj', trackingNumber: '123' },
  )
  assert.equal(r.orderNumbers, null)
  assert.equal(r.error?.message, 'boom')
})
