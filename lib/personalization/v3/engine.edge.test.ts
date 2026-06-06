/**
 * 추천 v3 — 엣지 케이스 가드 테스트.
 * 잘못된 입력(0/음수 MER), 빈 카탈로그, 다중 신호 조합이 안전하게 동작하는지 박제.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runLayerA } from './engine.ts'
import type { NeedProfile } from './types.ts'

function profile(overrides: Partial<NeedProfile> = {}): NeedProfile {
  return {
    weightGoal: 'maintain',
    activityLevel: 'medium',
    allergies: [],
    appetite: 'normal',
    senior: false,
    functionalConcerns: [],
    ...overrides,
  }
}

describe('엣지 — 잘못된 MER', () => {
  it('dailyKcal=0 → 그램 0, 크래시 없음, picks 유지', () => {
    const r = runLayerA(profile(), 0)
    assert.equal(r.dailyGrams, 0)
    assert.equal(r.needsConsultation, false)
    assert.ok(r.picks.length >= 1)
  })

  it('dailyKcal 음수 → 그램 0 하한(음수 안 샘)', () => {
    const r = runLayerA(profile(), -500)
    assert.equal(r.dailyGrams, 0)
  })

  it('간식 비율 음수 → 0 으로 클램프(무차감)', () => {
    const base = runLayerA(profile({ weightGoal: 'loss' }), 400)
    const neg = runLayerA(profile({ weightGoal: 'loss' }), 400, {
      treatReductionPct: -0.5,
    })
    assert.equal(neg.dailyGrams, base.dailyGrams)
  })
})

describe('엣지 — 빈 후보', () => {
  it('빈 catalog override → 상담 라우팅', () => {
    const r = runLayerA(profile(), 400, { catalog: [] })
    assert.equal(r.needsConsultation, true)
    assert.equal(r.picks.length, 0)
    assert.equal(r.dailyGrams, 0)
  })
})

describe('엣지 — 다중 신호 조합', () => {
  it('소화 우려 + 알레르기 → sensitive 신호로 오리(노블) 우선', () => {
    const r = runLayerA(
      profile({ allergies: ['소고기'], functionalConcerns: ['digestion'] }),
      400,
    )
    assert.ok(!r.picks.some((p) => p.protein === 'beef'), '소 제외')
    assert.equal(r.picks[0]!.protein, 'duck', 'sensitive → 노블 오리')
  })

  it('시니어 + 관절 우려 + 닭 알레르기 → 닭 제외, picks 유지', () => {
    const r = runLayerA(
      profile({
        senior: true,
        allergies: ['닭·칠면조'],
        functionalConcerns: ['joint'],
        activityLevel: 'low',
      }),
      350,
    )
    assert.equal(r.needsConsultation, false)
    assert.ok(!r.picks.some((p) => p.protein === 'chicken'))
    assert.ok(r.dailyGrams > 0)
  })

  it('특이 신호 전무 → 균형 기본값(닭 단독)', () => {
    const r = runLayerA(profile(), 400)
    assert.equal(r.picks.length, 1)
    assert.equal(r.picks[0]!.protein, 'chicken')
  })
})
