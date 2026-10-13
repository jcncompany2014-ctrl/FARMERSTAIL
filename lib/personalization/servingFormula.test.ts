import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentServingFormula, isServingFormula, servingFormulaByDog } from './servingFormula.ts'

/**
 * '지금 먹는 식단' 정본(2026-10-13 점검 E4) — 승인 대기·거절·시작 전은 먹는 식단이 아니다.
 */
const TODAY = '2026-10-13'
const row = (over: Record<string, unknown>) => ({
  id: 'x',
  dog_id: 'd1',
  approval_status: 'auto_applied',
  applied_from: null as string | null,
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})

test('승인 대기·거절·시작 전은 먹는 식단이 아니다', () => {
  assert.equal(isServingFormula(row({ approval_status: 'pending_approval' }), TODAY), false)
  assert.equal(isServingFormula(row({ approval_status: 'declined' }), TODAY), false)
  assert.equal(isServingFormula(row({ applied_from: '2026-10-20' }), TODAY), false)
  assert.equal(isServingFormula(row({ applied_from: '2026-10-13' }), TODAY), true, '오늘 시작은 먹는 식단')
  assert.equal(isServingFormula(row({ approval_status: 'approved', applied_from: '2026-09-29' }), TODAY), true)
  assert.equal(isServingFormula(row({ approval_status: null }), TODAY), true, '1회차(승인 칸 없음)')
})

test('최신 행이 거절·승인 대기·시작 전이면 그 앞의 먹는 식단을 고른다 — created_at 기준(회차 번호 아님)', () => {
  const rows = [
    row({ id: 'c1', cycle_number: 1, created_at: '2026-08-01T00:00:00Z' }),
    row({ id: 'c2', cycle_number: 2, approval_status: 'declined', created_at: '2026-09-10T00:00:00Z' }),
    row({ id: 'c3', cycle_number: 3, approval_status: 'pending_approval', created_at: '2026-10-10T00:00:00Z' }),
  ]
  assert.equal(currentServingFormula(rows, TODAY)?.id, 'c1')
  const withFuture = [...rows, row({ id: 'c4', approval_status: 'approved', applied_from: '2026-10-20', created_at: '2026-10-12T00:00:00Z' })]
  assert.equal(currentServingFormula(withFuture, TODAY)?.id, 'c1', '다음 박스부터 담길 식단은 아직 아니다')
  assert.equal(currentServingFormula(withFuture, '2026-10-20')?.id, 'c4', '시작일이 되면 그 식단')
  // 정렬은 호출처에 기대지 않는다 — 섞어 넣어도 같은 답.
  assert.equal(currentServingFormula([...withFuture].reverse(), TODAY)?.id, 'c1')
})

test('먹는 식단이 없으면 null', () => {
  assert.equal(currentServingFormula([row({ approval_status: 'declined' })], TODAY), null)
  assert.equal(currentServingFormula([], TODAY), null)
})

test('여러 강아지 — 강아지별로 고른다', () => {
  const m = servingFormulaByDog(
    [
      row({ id: 'a-old', dog_id: 'a', created_at: '2026-08-01T00:00:00Z' }),
      row({ id: 'a-new', dog_id: 'a', approval_status: 'pending_approval', created_at: '2026-10-01T00:00:00Z' }),
      row({ id: 'b-1', dog_id: 'b', created_at: '2026-09-01T00:00:00Z' }),
    ],
    TODAY,
  )
  assert.equal(m.get('a')?.id, 'a-old')
  assert.equal(m.get('b')?.id, 'b-1')
})
