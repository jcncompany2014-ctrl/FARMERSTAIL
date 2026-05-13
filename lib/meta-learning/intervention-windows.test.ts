import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  predictBestTiming,
  longTermOutcomeScore,
} from './intervention-windows.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
})

describe('predictBestTiming', () => {
  it('표본 < 3 → default hint', () => {
    const r = predictBestTiming(
      [{ hour: 9, dayOfWeek: 1 }],
      [{ hour: 9, dayOfWeek: 1 }],
    )
    assert.equal(r.hour, 9)
    assert.equal(r.confidence, 0)
  })

  it('표본 충분 + 특정 시간 응답률 높음 → best hour 추출', () => {
    const sent = [
      ...Array(5).fill({ hour: 9, dayOfWeek: 1 }),
      ...Array(5).fill({ hour: 18, dayOfWeek: 1 }),
    ]
    const responded = [
      // 9시 1/5 응답, 18시 4/5 응답
      { hour: 9, dayOfWeek: 1 },
      ...Array(4).fill({ hour: 18, dayOfWeek: 1 }),
    ]
    const r = predictBestTiming(sent, responded)
    assert.equal(r.hour, 18)
  })

  it('flag OFF → default', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    const r = predictBestTiming(
      Array(20).fill({ hour: 14, dayOfWeek: 2 }),
      Array(15).fill({ hour: 14, dayOfWeek: 2 }),
    )
    assert.equal(r.hour, 9)
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
  })

  it('confidence — 표본 크기에 비례', () => {
    const sent = Array(50).fill({ hour: 10, dayOfWeek: 3 })
    const responded = Array(30).fill({ hour: 10, dayOfWeek: 3 })
    const r = predictBestTiming(sent, responded)
    assert.equal(r.confidence, 0.5)
  })
})

describe('longTermOutcomeScore', () => {
  it('마지막 BCS 가 target (5) 와 일치 → 1.0', () => {
    const s = longTermOutcomeScore(
      [
        { week: 0, bcs: 7 },
        { week: 4, bcs: 5 },
      ],
      5,
    )
    assert.equal(s, 1)
  })

  it('마지막 BCS 가 멀어질수록 → 점수 ↓', () => {
    const s = longTermOutcomeScore(
      [
        { week: 0, bcs: 5 },
        { week: 4, bcs: 9 },
      ],
      5,
    )
    assert.equal(s, 0)
  })

  it('빈 array → 0', () => {
    assert.equal(longTermOutcomeScore([], 5), 0)
  })
})
