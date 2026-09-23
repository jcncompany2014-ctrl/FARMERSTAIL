/**
 * computeStartTeaser — /start 웹 라이트 설문 → 간결 티저 매핑 회귀 테스트.
 *
 * 보호 대상:
 *   1. 유효 draft → 실값(merKcal/feedG > 0, 추천 단백질 1~2)
 *   2. 알레르기 단백질은 추천에서 제외
 *   3. '없어요'(none) 센티넬은 무시(필터)
 *   4. 체중 누락 / draft 없음 → null (방어)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeStartTeaser, draftToNutritionInput, HEALTH_KR } from './start-teaser.ts'
import type { AutosignupDraft } from './autosignup-draft.ts'

const baseDog: AutosignupDraft['dog'] = {
  name: '코코',
  breed: '말티즈',
  gender: 'male',
  neutered: true,
  birthDate: '2021-05-10',
  ageValue: '3',
  ageUnit: 'years',
  weight: '4.5',
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

  it('체중 누락 → null', () => {
    assert.equal(computeStartTeaser(mk({ ...baseDog, weight: '' })), null)
  })

  it('draft 없음(null) → null', () => {
    assert.equal(computeStartTeaser(null), null)
  })
})

it('웹 관심사(영문 키)는 영양 계산이 읽는 한글 라벨로 answers.healthConcerns 에 들어간다 (2026-09-23)', () => {
  const m = draftToNutritionInput({
    v: 1,
    ts: 0,
    dog: { name: '코코', weight: '4', ageValue: '3', ageUnit: 'years', neutered: true, gender: 'male' },
    answers: { health: ['skin', 'joint', 'none'] },
  })
  assert.ok(m)
  assert.deepEqual(m!.answers.healthConcerns, ['피부/털', '관절'])
  // 티저·보충제 쪽이 쓰는 원본 키는 그대로
  assert.deepEqual(m!.health, ['skin', 'joint'])
  assert.equal(HEALTH_KR.weight, '체중')
})
