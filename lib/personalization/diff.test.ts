/**
 * diffFormulas 단위 테스트.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffFormulas } from './diff.ts'
import type { Formula } from './types.ts'

function f(overrides: Partial<Formula> = {}): Formula {
  return {
    lineRatios: { basic: 0.5, weight: 0.1, skin: 0.2, premium: 0.1, joint: 0.1 },
    toppers: { protein: 0.05, vegetable: 0.1 },
    reasoning: [],
    transitionStrategy: 'gradual',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
    ...overrides,
  }
}

describe('diffFormulas — 미세 변화', () => {
  it('동일 → not meaningful', () => {
    const d = diffFormulas(f(), f())
    assert.equal(d.meaningful, false)
    assert.equal(d.changes.length, 0)
    assert.equal(d.forced, false)
  })

  it('5% 미만 변화 → not meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.55, weight: 0.05, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, false)
  })
})

describe('diffFormulas — 의미 있는 변화', () => {
  it('단일 라인 +10% → meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.4, weight: 0.2, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Basic')))
    assert.ok(d.changes.some((c) => c.includes('Weight')))
  })

  it('새 라인 추가 → meaningful + 라인 추가 message', () => {
    const d = diffFormulas(
      f({
        lineRatios: { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 },
      }),
      f({
        lineRatios: { basic: 0.7, weight: 0, skin: 0.3, premium: 0, joint: 0 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Skin') && c.includes('추가')))
  })

  it('라인 제거 → meaningful + 제외 message', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.6, weight: 0.2, skin: 0, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Skin') && c.includes('제외')))
  })

  it('토퍼 5%+ 변화 → meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        toppers: { protein: 0.05, vegetable: 0.2 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('야채 토퍼')))
  })

  it('일일 kcal 10%+ 변화 → meaningful', () => {
    const d = diffFormulas(
      f({ dailyKcal: 280 }),
      f({ dailyKcal: 320 }), // +14%
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('칼로리')))
  })
})

describe('diffFormulas — 강제 적용', () => {
  it('새 알레르기 → forced=true', () => {
    const prev = f()
    const next = f({
      reasoning: [
        {
          trigger: '닭 알레르기',
          action: 'Basic 0%',
          chipLabel: '닭 차단',
          priority: 0,
          ruleId: 'allergy-basic',
        },
      ],
      lineRatios: { basic: 0, weight: 0.5, skin: 0.2, premium: 0.2, joint: 0.1 },
    })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, true)
    assert.equal(d.meaningful, true)
    assert.ok(d.forceReasons.some((r) => r.includes('알레르기')))
  })

  it('새 만성질환 → forced=true', () => {
    const prev = f()
    const next = f({
      reasoning: [
        {
          trigger: 'CKD',
          action: 'Premium 0%',
          chipLabel: '신장 → 저단백',
          priority: 3,
          ruleId: 'chronic-kidney',
        },
      ],
      lineRatios: { basic: 0.6, weight: 0.1, skin: 0.2, premium: 0, joint: 0.1 },
    })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, true)
    assert.ok(d.forceReasons.some((r) => r.includes('만성질환')))
  })

  it('이미 있던 알레르기 → forced=false', () => {
    const reasoning = [
      {
        trigger: '닭 알레르기',
        action: 'Basic 0%',
        chipLabel: '닭 차단',
        priority: 0,
        ruleId: 'allergy-basic',
      },
    ]
    const prev = f({ reasoning, lineRatios: { basic: 0, weight: 0.5, skin: 0.2, premium: 0.2, joint: 0.1 } })
    const next = f({ reasoning, lineRatios: { basic: 0, weight: 0.4, skin: 0.3, premium: 0.2, joint: 0.1 } })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, false)
  })
})

describe('diffFormulas — 메시지 형식', () => {
  it('changes 가 사람-읽기-쉬운 한국어', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.3, weight: 0.3, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    // 모든 메시지에 화살표 또는 % 포함
    for (const c of d.changes) {
      assert.ok(/%|→|↑|↓|추가|제외/.test(c), `메시지 형식: ${c}`)
    }
  })
})
