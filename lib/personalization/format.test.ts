/**
 * Formula 포매터 단위 테스트.
 *
 * (2026-07-24: 미사용 포매터 7종 삭제에 맞춰 그 테스트도 제거하고,
 *  prod 사용 중인 recipeName·friendlyChangeReason 커버리지로 교체.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recipeName, friendlyChangeReason } from './format.ts'
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
    reasoning: [],
    transitionStrategy: 'conservative',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
  }
}

describe('recipeName — 원물명(%·형용사 없이)', () => {
  it('2종 섞임 → 비중 상위 2개 원물 · 로 연결 + "레시피"', () => {
    const s = recipeName(baseFormula())
    assert.match(s, /레시피$/)
    assert.match(s, /·/, '두 원물이 · 로 연결')
    assert.doesNotMatch(s, /%/, '비율% 노출 금지')
    assert.doesNotMatch(s, /프레시|무항생제|프리미엄/, '형용사 배제')
  })

  it('단일 라인 100% → 원물 1개 (· 없음)', () => {
    const f = baseFormula()
    f.lineRatios = { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 }
    const s = recipeName(f)
    assert.match(s, /레시피$/)
    assert.doesNotMatch(s, /·/)
  })

  it('모든 라인 0% → "맞춤 레시피" fallback', () => {
    const f = baseFormula()
    f.lineRatios = { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0 }
    assert.equal(recipeName(f), '맞춤 레시피')
  })
})

describe('friendlyChangeReason — 변경 사유 고객 문장', () => {
  it('forced + 알레르기 → 새 알레르기 반영(원물 한글)', () => {
    const s = friendlyChangeReason([{ ruleId: 'allergy-basic' }], true)
    assert.match(s, /알레르기를 반영/)
  })

  it('next-allergy- 접두 + 원물 한글 변환(chicken→닭)', () => {
    const s = friendlyChangeReason([{ ruleId: 'next-allergy-chicken' }], true)
    assert.match(s, /닭 알레르기를 반영/)
  })

  it('forced 인데 알레르기 아님 → 건강 상태(만성질환)', () => {
    const s = friendlyChangeReason([{ ruleId: 'chronic-kidney' }], true)
    assert.equal(s, '건강 상태(만성질환)를 반영하려고요.')
  })

  it('forced 아님 → 체크인·몸무게 변화', () => {
    const s = friendlyChangeReason([], false)
    assert.equal(s, '그동안의 체크인과 몸무게 변화를 반영했어요.')
  })
})
