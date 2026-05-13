import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_LINES,
  FOOD_LINE_META,
  PROTEIN_TO_LINE,
} from './lines.ts'

describe('FOOD_LINE_META', () => {
  it('5개 라인 모두 정의', () => {
    assert.equal(ALL_LINES.length, 5)
    for (const line of ALL_LINES) {
      assert.ok(FOOD_LINE_META[line])
    }
  })

  it('각 라인 name + proteinPctDM + fatPctDM 필수', () => {
    for (const line of ALL_LINES) {
      const m = FOOD_LINE_META[line]
      assert.ok(m.name)
      assert.ok(typeof m.proteinPctDM === 'number')
      assert.ok(typeof m.fatPctDM === 'number')
      // color 는 hex (#) 또는 CSS var(--*).
      assert.ok(
        m.color.startsWith('#') || m.color.startsWith('var('),
        `${line}: ${m.color}`,
      )
    }
  })

  it('단백질 % 25~45 범위 (화식 합리적)', () => {
    for (const line of ALL_LINES) {
      const p = FOOD_LINE_META[line].proteinPctDM
      assert.ok(p >= 20 && p <= 50, `${line}: ${p}`)
    }
  })

  it('지방 % 5~25 범위', () => {
    for (const line of ALL_LINES) {
      const f = FOOD_LINE_META[line].fatPctDM
      assert.ok(f >= 5 && f <= 25, `${line}: ${f}`)
    }
  })
})

describe('PROTEIN_TO_LINE', () => {
  it('주요 단백질 매핑', () => {
    assert.ok(PROTEIN_TO_LINE['chicken'])
    assert.ok(PROTEIN_TO_LINE['beef'])
    assert.ok(PROTEIN_TO_LINE['salmon'])
  })

  it('매핑 값이 ALL_LINES 안에 있음', () => {
    for (const v of Object.values(PROTEIN_TO_LINE)) {
      assert.ok(ALL_LINES.includes(v))
    }
  })
})
