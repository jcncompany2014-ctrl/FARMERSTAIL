/**
 * Formula 포매터 단위 테스트.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mainLineOf,
  formatLineRatios,
  formatToppers,
  transitionLabel,
  totalGrams,
  formatFormulaSummary,
  formatReasoningSummary,
} from './format.ts'
import type { Formula } from './types.ts'

function baseFormula(): Formula {
  return {
    lineRatios: {
      basic: 0,
      weight: 0.3,
      skin: 0.1,
      premium: 0,
      joint: 0.6,
    },
    toppers: { protein: 0.05, vegetable: 0.1 },
    reasoning: [
      {
        trigger: '닭 알레르기',
        action: 'Basic 0%',
        chipLabel: '닭 알레르기 차단',
        priority: 0,
        ruleId: 'allergy-basic',
      },
      {
        trigger: '7세 시니어',
        action: 'Joint 60%',
        chipLabel: '시니어 → Joint 메인',
        priority: 1,
        ruleId: 'goal-joint_senior',
      },
      {
        trigger: 'BCS 6/9',
        action: 'Weight 30%',
        chipLabel: 'BCS 6/9 → Weight ↑',
        priority: 4,
        ruleId: 'bcs-overweight',
      },
    ],
    transitionStrategy: 'conservative',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
  }
}

describe('mainLineOf', () => {
  it('가장 비중 큰 라인', () => {
    const f = baseFormula()
    const main = mainLineOf(f)
    assert.equal(main.line, 'joint')
    assert.equal(main.pct, 60)
    assert.equal(main.name, 'Joint')
  })

  it('동률일 때 ALL_LINES 첫 라인 우선', () => {
    const f = baseFormula()
    f.lineRatios = {
      basic: 0.5,
      weight: 0.5,
      skin: 0,
      premium: 0,
      joint: 0,
    }
    const main = mainLineOf(f)
    assert.equal(main.line, 'basic')
  })
})

describe('formatLineRatios', () => {
  it('비중 내림차순 + 0% 제외', () => {
    const s = formatLineRatios(baseFormula())
    assert.equal(s, 'Joint 60% / Weight 30% / Skin 10%')
  })

  it('단일 라인 100%', () => {
    const f = baseFormula()
    f.lineRatios = { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 }
    assert.equal(formatLineRatios(f), 'Basic 100%')
  })
})

describe('formatToppers', () => {
  it('둘 다 있을 때', () => {
    assert.equal(formatToppers(baseFormula()), '야채 +10%, 육류 +5%')
  })

  it('야채만', () => {
    const f = baseFormula()
    f.toppers = { protein: 0, vegetable: 0.1 }
    assert.equal(formatToppers(f), '야채 +10%')
  })

  it('둘 다 0 → 빈 문자열', () => {
    const f = baseFormula()
    f.toppers = { protein: 0, vegetable: 0 }
    assert.equal(formatToppers(f), '')
  })
})

describe('transitionLabel', () => {
  it('aggressive', () => {
    const f = baseFormula()
    f.transitionStrategy = 'aggressive'
    assert.equal(transitionLabel(f), '즉시 풀비율 적용')
  })
  it('gradual', () => {
    const f = baseFormula()
    f.transitionStrategy = 'gradual'
    assert.equal(transitionLabel(f), '2주 점진 전환')
  })
  it('conservative', () => {
    assert.equal(transitionLabel(baseFormula()), '4주 보수적 전환')
  })
})

describe('totalGrams', () => {
  it('1주 = daily × 7', () => {
    assert.equal(totalGrams(baseFormula(), '1w'), 1400)
  })
  it('4주 = daily × 28', () => {
    assert.equal(totalGrams(baseFormula(), '4w'), 5600)
  })
  it('default = 1주', () => {
    assert.equal(totalGrams(baseFormula()), 1400)
  })
})

describe('formatFormulaSummary', () => {
  it('한 단락 요약', () => {
    const s = formatFormulaSummary(baseFormula())
    assert.match(s, /Joint 60%/)
    assert.match(s, /야채 \+10%/)
    assert.match(s, /4주 보수적 전환/)
    assert.match(s, /280 kcal\/일/)
  })

  it('토퍼 없으면 toppers 부분 생략', () => {
    const f = baseFormula()
    f.toppers = { protein: 0, vegetable: 0 }
    const s = formatFormulaSummary(f)
    assert.doesNotMatch(s, /야채/)
    assert.doesNotMatch(s, /육류/)
  })
})

describe('formatReasoningSummary', () => {
  it('priority 오름차순 max 3', () => {
    const s = formatReasoningSummary(baseFormula())
    assert.equal(
      s,
      '닭 알레르기 차단 · 시니어 → Joint 메인 · BCS 6/9 → Weight ↑',
    )
  })

  it('maxItems 1 → 1개만', () => {
    const s = formatReasoningSummary(baseFormula(), 1)
    assert.equal(s, '닭 알레르기 차단')
  })

  it('reasoning 빈 배열 → 빈 문자열', () => {
    const f = baseFormula()
    f.reasoning = []
    assert.equal(formatReasoningSummary(f), '')
  })
})
