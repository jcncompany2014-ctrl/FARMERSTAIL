/**
 * 추천 v3 — 2주 피드백 해석 테스트.
 * 변/식욕/모질/만족 신호 → NeedProfile nudge + 소스 우려 + 재분석 플래그.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { interpretTwoWeekFeedback } from './feedback.ts'
import type { TwoWeekFeedback } from './types.ts'

function fb(overrides: Partial<TwoWeekFeedback> = {}): TwoWeekFeedback {
  return {
    stoolScore: null,
    coatScore: null,
    appetiteScore: null,
    satisfaction: null,
    ...overrides,
  }
}

describe('interpretTwoWeekFeedback', () => {
  it('무른 변(6) → 소화 우려 + 재분석', () => {
    const r = interpretTwoWeekFeedback(fb({ stoolScore: 6 }))
    assert.ok(r.addConcerns.includes('digestion'))
    assert.equal(r.shouldReanalyze, true)
  })

  it('단단한 변(2) → 메모만(재분석 X)', () => {
    const r = interpretTwoWeekFeedback(fb({ stoolScore: 2 }))
    assert.equal(r.addConcerns.length, 0)
    assert.equal(r.shouldReanalyze, false)
    assert.ok(r.notes.some((n) => n.includes('단단')))
  })

  it('식욕 저하(2) → appetite=picky nudge + 재분석', () => {
    const r = interpretTwoWeekFeedback(fb({ appetiteScore: 2 }))
    assert.equal(r.profileNudges.appetite, 'picky')
    assert.equal(r.shouldReanalyze, true)
  })

  it('모질 아쉬움(2) → 피부 소스 우려(재분석은 강제 X)', () => {
    const r = interpretTwoWeekFeedback(fb({ coatScore: 2 }))
    assert.ok(r.addConcerns.includes('skin'))
  })

  it('전반 불만족(1) → 재분석 권장', () => {
    const r = interpretTwoWeekFeedback(fb({ satisfaction: 1 }))
    assert.equal(r.shouldReanalyze, true)
  })

  it('전반 순조(변4·식욕4·만족5) → 유지, 재분석 X', () => {
    const r = interpretTwoWeekFeedback(
      fb({ stoolScore: 4, appetiteScore: 4, satisfaction: 5 }),
    )
    assert.equal(r.shouldReanalyze, false)
    assert.equal(r.addConcerns.length, 0)
    assert.ok(r.notes.some((n) => n.includes('순조')))
  })

  it('무응답(전부 null) → 메모 존재 + 변화 없음', () => {
    const r = interpretTwoWeekFeedback(fb())
    assert.ok(r.notes.length > 0)
    assert.equal(r.shouldReanalyze, false)
    assert.equal(r.addConcerns.length, 0)
    assert.deepEqual(r.profileNudges, {})
  })

  it('복합 악화(무른 변6 + 식욕2 + 모질2 + 불만족2)', () => {
    const r = interpretTwoWeekFeedback(
      fb({ stoolScore: 6, appetiteScore: 2, coatScore: 2, satisfaction: 2 }),
    )
    assert.ok(r.addConcerns.includes('digestion'))
    assert.ok(r.addConcerns.includes('skin'))
    assert.equal(r.profileNudges.appetite, 'picky')
    assert.equal(r.shouldReanalyze, true)
    // addConcerns 중복 없음
    assert.equal(new Set(r.addConcerns).size, r.addConcerns.length)
  })
})
