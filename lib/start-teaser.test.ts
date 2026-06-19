/**
 * computeStartTeaser — /start 웹 라이트 설문 → 간결 티저 매핑 회귀 테스트.
 *
 * 보호 대상:
 *   1. 유효 draft → 실값(merKcal/feedG > 0, 추천 단백질 1~2)
 *   2. 알레르기 단백질은 추천에서 제외
 *   3. '없어요'(none) 센티넬은 무시(필터)
 *   4. 활동량 높음 > 낮음 (MER 방향성)
 *   5. 체중 누락 / draft 없음 → null (방어)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeStartTeaser } from './start-teaser.ts'
import type { AutosignupDraft } from './autosignup-draft.ts'

const baseDog: AutosignupDraft['dog'] = {
  name: '코코',
  breed: '말티즈',
  gender: 'male',
  neutered: true,
  ageValue: '3',
  ageUnit: 'years',
  weight: '4.5',
  activityLevel: 'medium',
}

function mk(
  dog: AutosignupDraft['dog'],
  answers: AutosignupDraft['answers'] = {},
): AutosignupDraft {
  return { v: 1, ts: 0, dog, answers }
}

describe('computeStartTeaser', () => {
  it('유효 draft → 실값 반환', () => {
    const t = computeStartTeaser(mk(baseDog, { body: 'ideal' }))
    assert.ok(t, '결과가 null 이면 안 됨')
    assert.equal(t.dogName, '코코')
    assert.ok(t.merKcal > 0, 'merKcal > 0')
    assert.ok(t.feedG > 0, 'feedG > 0')
    assert.ok(t.proteins.length >= 1 && t.proteins.length <= 2)
  })

  it('알레르기 단백질은 추천에서 제외', () => {
    const t = computeStartTeaser(mk(baseDog, { body: 'ideal', allergy: ['duck', 'salmon'] }))
    assert.ok(t)
    assert.ok(!t.proteins.includes('오리'), '오리 제외')
    assert.ok(!t.proteins.includes('연어'), '연어 제외')
  })

  it("'없어요'(none) 센티넬은 추천에 영향 없음", () => {
    const t = computeStartTeaser(mk(baseDog, { body: 'ideal', allergy: ['none'] }))
    assert.ok(t)
    assert.ok(t.proteins.length >= 1)
  })

  it('활동량 높음 > 낮음 (MER)', () => {
    const low = computeStartTeaser(mk({ ...baseDog, activityLevel: 'low' }, { body: 'ideal' }))
    const high = computeStartTeaser(mk({ ...baseDog, activityLevel: 'high' }, { body: 'ideal' }))
    assert.ok(low && high)
    assert.ok(high.merKcal > low.merKcal, '활동량 높을수록 칼로리 큼')
  })

  it('체중 누락 → null', () => {
    assert.equal(computeStartTeaser(mk({ ...baseDog, weight: '' })), null)
  })

  it('draft 없음(null) → null', () => {
    assert.equal(computeStartTeaser(null), null)
  })
})
