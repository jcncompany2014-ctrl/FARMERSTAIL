import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NEIGHBOR_LABEL, NEIGHBOR_RATES, pickWithNeighbor } from './neighbor.ts'

describe('이웃 할인 — 어느 할인을 쓰나', () => {
  it('이웃 할인이 더 크면 이웃 할인, 아니면 원래 고른 것(등급/이벤트)', () => {
    assert.deepEqual(pickWithNeighbor({ rate: 0.1, label: '나무 등급' }, { rate: 0.2 }), {
      useNeighbor: true,
      rate: 0.2,
      label: NEIGHBOR_LABEL,
    })
    assert.deepEqual(pickWithNeighbor({ rate: 0.5, label: '이벤트 할인' }, { rate: 0.2 }), {
      useNeighbor: false,
      rate: 0.5,
      label: '이벤트 할인',
    })
  })
  it('같은 값이면 이웃 할인은 아껴 둔다(1회 소진이라)', () => {
    assert.equal(pickWithNeighbor({ rate: 0.1, label: '나무 등급' }, { rate: 0.1 }).useNeighbor, false)
  })
  it('이웃 할인이 없거나 0 이면 원래 것', () => {
    assert.equal(pickWithNeighbor({ rate: 0, label: '' }, null).useNeighbor, false)
    assert.equal(pickWithNeighbor({ rate: 0, label: '' }, { rate: 0 }).useNeighbor, false)
    assert.equal(pickWithNeighbor({ rate: 0, label: '' }, { rate: 0.15 }).useNeighbor, true)
  })
  it('선택지는 10·15·20·30·50% 뿐', () => {
    assert.deepEqual([...NEIGHBOR_RATES], [0.1, 0.15, 0.2, 0.3, 0.5])
  })
})
