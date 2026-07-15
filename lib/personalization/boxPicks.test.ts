/**
 * boxPicks 단위 테스트 — 레시피 고르기 규칙.
 *
 * 핵심 회귀 방지 (사장님 2026-07-15 "2종 50%씩까지만 되는 거 생각해서"):
 *  1. 절대 3칸이 되지 않는다 — 어떤 순서로 눌러도.
 *  2. 빈 박스가 되지 않는다 — 마지막 하나는 못 뺀다.
 *  3. 비율은 1종 100% / 2종 50:50 뿐. 합은 항상 1.
 *  4. 알레르기 차단 레시피는 못 담는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  togglePick,
  ratiosFromPicks,
  picksChanged,
  MAX_PICKS,
} from './boxPicks.ts'
import type { FoodLine } from './types.ts'

const NONE = new Set<FoodLine>()
const ALL: FoodLine[] = ['weight', 'premium', 'basic', 'joint']

describe('togglePick — 담기', () => {
  it('빈 칸에 담으면 들어간다', () => {
    const r = togglePick(['weight'], 'premium', NONE)
    assert.deepEqual(r.picks, ['weight', 'premium'])
    assert.equal(r.rejected, false)
  })

  it('2칸이 다 찼는데 새로 고르면 먼저 담은 게 빠진다', () => {
    const r = togglePick(['weight', 'premium'], 'joint', NONE)
    assert.deepEqual(r.picks, ['premium', 'joint'])
    assert.equal(r.rejected, false)
  })

  it('어떤 순서로 눌러도 3칸이 되지 않는다', () => {
    let picks: FoodLine[] = ['weight']
    // 4종을 여러 바퀴 마구 누른다.
    for (let round = 0; round < 5; round++) {
      for (const line of ALL) {
        picks = togglePick(picks, line, NONE).picks
        assert.ok(picks.length <= MAX_PICKS, `초과: ${picks.join(',')}`)
        assert.ok(picks.length >= 1, '빈 박스 발생')
        assert.equal(new Set(picks).size, picks.length, `중복: ${picks.join(',')}`)
      }
    }
  })
})

describe('togglePick — 빼기', () => {
  it('2칸 중 하나를 빼면 1칸이 된다', () => {
    const r = togglePick(['weight', 'premium'], 'weight', NONE)
    assert.deepEqual(r.picks, ['premium'])
    assert.equal(r.rejected, false)
  })

  it('마지막 하나는 뺄 수 없다 (빈 박스 금지)', () => {
    const r = togglePick(['weight'], 'weight', NONE)
    assert.deepEqual(r.picks, ['weight'])
    assert.equal(r.rejected, true)
  })
})

describe('togglePick — 알레르기 차단', () => {
  it('차단된 레시피는 담기지 않고 거절된다', () => {
    const blocked = new Set<FoodLine>(['weight'])
    const r = togglePick(['premium'], 'weight', blocked)
    assert.deepEqual(r.picks, ['premium'])
    assert.equal(r.rejected, true)
  })

  it('차단은 밀어내기보다 먼저 판정된다 (2칸이 차 있어도 거절)', () => {
    const blocked = new Set<FoodLine>(['joint'])
    const r = togglePick(['weight', 'premium'], 'joint', blocked)
    assert.deepEqual(r.picks, ['weight', 'premium'])
    assert.equal(r.rejected, true)
  })
})

describe('ratiosFromPicks — 실제 박스 비율', () => {
  it('1종 → 100%', () => {
    const r = ratiosFromPicks(['weight'])
    assert.equal(r.weight, 1)
    assert.equal(r.premium, 0)
  })

  it('2종 → 50:50', () => {
    const r = ratiosFromPicks(['weight', 'premium'])
    assert.equal(r.weight, 0.5)
    assert.equal(r.premium, 0.5)
  })

  it('합은 항상 1 (빈 경우 제외)', () => {
    for (const picks of [['weight'], ['weight', 'premium'], ['basic', 'joint']] as FoodLine[][]) {
      const r = ratiosFromPicks(picks)
      const sum = Object.values(r).reduce((a, b) => a + b, 0)
      assert.equal(+sum.toFixed(6), 1, `합 != 1: ${picks.join(',')}`)
    }
  })

  it('빈 배열 → 전부 0 (NaN 방지)', () => {
    const r = ratiosFromPicks([])
    assert.deepEqual(r, { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0 })
  })

  it('연어(skin)는 고를 수 없지만 비율 Record 키는 유지된다(저장 형식 호환)', () => {
    const r = ratiosFromPicks(['weight', 'premium'])
    assert.ok('skin' in r)
    assert.equal(r.skin, 0)
  })
})

describe('picksChanged — 추천 대비 변경 여부', () => {
  it('같은 구성이면 순서가 달라도 변경 아님', () => {
    assert.equal(picksChanged(['premium', 'weight'], ['weight', 'premium']), false)
  })

  it('구성이 다르면 변경', () => {
    assert.equal(picksChanged(['weight', 'joint'], ['weight', 'premium']), true)
  })

  it('개수가 다르면 변경', () => {
    assert.equal(picksChanged(['weight'], ['weight', 'premium']), true)
  })
})
