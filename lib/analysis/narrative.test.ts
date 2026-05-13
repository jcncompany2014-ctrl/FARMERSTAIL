import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeHistory } from './narrative.ts'

const oldDate = '2025-01-01'
const midDate = '2025-02-15'
const newDate = '2025-03-15'

describe('summarizeHistory', () => {
  it('데이터 < 2 points → null', () => {
    assert.equal(summarizeHistory([]), null)
    assert.equal(
      summarizeHistory([{ date: oldDate, bcs: 5, weight: 5 }]),
      null,
    )
  })

  it('BCS 7 → 5 → positive ("이상에 가까워졌어요")', () => {
    const n = summarizeHistory(
      [
        { date: oldDate, bcs: 7, weight: 5 },
        { date: newDate, bcs: 5, weight: 5 },
      ],
      '초롱이',
    )
    assert.ok(n)
    assert.equal(n.tone, 'positive')
    assert.match(n.text, /초롱이|이상/)
  })

  it('BCS 3 → 5 → positive ("건강한 방향")', () => {
    const n = summarizeHistory(
      [
        { date: oldDate, bcs: 3, weight: 4 },
        { date: newDate, bcs: 5, weight: 4.5 },
      ],
      '바둑이',
    )
    assert.ok(n)
    assert.equal(n.tone, 'positive')
  })

  it('체중 안정 ±0.3kg → positive ("안정적")', () => {
    const n = summarizeHistory([
      { date: oldDate, bcs: 5, weight: 5.0 },
      { date: newDate, bcs: 5, weight: 5.2 },
    ])
    assert.ok(n)
    assert.equal(n.tone, 'positive')
    assert.match(n.text, /안정/)
  })

  it('체중 큰 변화 → neutral', () => {
    const n = summarizeHistory([
      { date: oldDate, bcs: 5, weight: 5.0 },
      { date: newDate, bcs: 5, weight: 6.0 },
    ])
    assert.ok(n)
    assert.equal(n.tone, 'neutral')
  })

  it('변화 없음 → positive ("안정적")', () => {
    const n = summarizeHistory([
      { date: oldDate, bcs: 5, weight: 5.0 },
      { date: midDate, bcs: 5, weight: 5.0 },
      { date: newDate, bcs: 5, weight: 5.0 },
    ])
    assert.ok(n)
    assert.equal(n.tone, 'positive')
  })

  it('dogName null → "강아지"', () => {
    const n = summarizeHistory([
      { date: oldDate, bcs: 7, weight: 5 },
      { date: newDate, bcs: 5, weight: 5 },
    ])
    assert.ok(n)
    assert.match(n.text, /강아지/)
  })
})
