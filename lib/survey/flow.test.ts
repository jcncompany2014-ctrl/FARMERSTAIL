import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildScreens,
  counterLabel,
  isScreenKey,
  isSkippable,
  legacyStepToScreen,
  mainCount,
  progressPct,
  screenError,
  type FlowAnswers,
} from './flow.ts'

const adultMale = { gender: 'male' as const, neutered: true, ageMonths: 48 }
const intactFemale = { gender: 'female' as const, neutered: false, ageMonths: 48 }
const puppy = { gender: 'male' as const, neutered: false, ageMonths: 6 }
const unknownIntact = { gender: null, neutered: false, ageMonths: 30 }

const blank: FlowAnswers = {
  ribs: '',
  waist: '',
  abdomen: '',
  weightTrend: '',
  bristol: null,
  stoolSkipped: false,
  foodType: '',
  snackFreq: '',
  homeCookingExp: '',
  dlMode: '',
  allergies: [],
  hasChronic: '',
  chronicConditions: [],
  prescriptionDiet: '',
  pregnancy: '',
  careGoal: '',
  optChoice: '',
}

test('중성화 수컷 성견 — 항상 11 + 관문 1, 조건부 0, 관문 전엔 선택 0', () => {
  const s = buildScreens(adultMale, '')
  assert.deepEqual(
    s.map((x) => x.key),
    ['ribs', 'waist', 'abdomen', 'weight', 'stool', 'food', 'snack', 'fresh', 'allergy', 'chronic', 'goal', 'gate'],
  )
  assert.equal(mainCount(s), 11)
  assert.equal(s.filter((x) => x.part === 'conditional').length, 0)
})

test('비중성화 암컷 — 임신·수유 화면이 질환 뒤·목표 앞에 조건부로 들어간다', () => {
  const s = buildScreens(intactFemale, '')
  const keys = s.map((x) => x.key)
  assert.ok(keys.includes('pregnancy'))
  assert.equal(keys.indexOf('pregnancy'), keys.indexOf('chronic') + 1)
  assert.equal(keys.indexOf('goal'), keys.indexOf('pregnancy') + 1)
  assert.equal(mainCount(s), 12)
  // 성별 미상(legacy) + 비중성화도 노출(수컷에 켜져 MER 폭주하던 사고의 반대 — 모르면 물어본다)
  assert.ok(buildScreens(unknownIntact, '').some((x) => x.key === 'pregnancy'))
})

test('18개월 미만 자견 — 예상 성견 체중 화면(건너뛰기 가능)', () => {
  const s = buildScreens(puppy, '')
  assert.ok(s.some((x) => x.key === 'adultWeight' && x.part === 'conditional'))
  assert.ok(isSkippable('adultWeight'))
  assert.equal(screenError('adultWeight', blank), null)
})

test('관문에서 "답하기"면 선택 4개가 붙고, "건너뛰기"면 붙지 않는다', () => {
  const answer = buildScreens(adultMale, 'answer')
  assert.deepEqual(
    answer.slice(-4).map((x) => x.key),
    ['optFood', 'optWalk', 'optExercise', 'optMeds'],
  )
  assert.ok(answer.slice(-4).every((x) => x.part === 'optional' && isSkippable(x.key)))
  const skip = buildScreens(adultMale, 'skip')
  assert.equal(skip[skip.length - 1]!.key, 'gate')
  // 선택 화면은 답이 없어도 에러가 없다(건너뛰기가 구조적으로 허용)
  for (const k of ['optFood', 'optWalk', 'optExercise', 'optMeds'] as const) {
    assert.equal(screenError(k, blank), null)
  }
})

test('카운터 문구 — 본 질문은 "질문 n / N", 선택은 "추가 질문 n / 4", 관문은 빈 문구, 영어 없음', () => {
  const s = buildScreens(adultMale, 'answer')
  assert.equal(counterLabel(s, 0), '질문 1 / 11')
  assert.equal(counterLabel(s, 10), '질문 11 / 11')
  assert.equal(counterLabel(s, 11), '')
  assert.equal(counterLabel(s, 12), '추가 질문 1 / 4')
  assert.equal(counterLabel(s, 15), '추가 질문 4 / 4')
  for (let i = 0; i < s.length; i++) {
    assert.doesNotMatch(counterLabel(s, i), /[A-Za-z]/, `화면 ${i} 카운터에 영어`)
  }
  assert.equal(progressPct(s, 0), 0)
  assert.equal(progressPct(s, s.length - 1), 100)
})

test('필수 화면은 답이 없으면 "어디를 누르면 되는지"가 담긴 한글 안내를 돌려준다', () => {
  const required = ['ribs', 'waist', 'abdomen', 'weight', 'stool', 'food', 'snack', 'fresh', 'allergy', 'chronic', 'goal', 'gate', 'pregnancy'] as const
  for (const k of required) {
    const e = screenError(k, blank)
    assert.ok(e && /[가-힣]/.test(e), `${k}: 안내 없음`)
    assert.doesNotMatch(e!, /[A-Za-z]/, `${k}: 안내에 영어`)
  }
  // 답하면 통과
  assert.equal(screenError('ribs', { ...blank, ribs: 'easy' }), null)
  assert.equal(screenError('weight', { ...blank, weightTrend: 'unknown' }), null)
  assert.equal(screenError('goal', { ...blank, careGoal: 'general_upgrade' }), null)
  assert.equal(screenError('gate', { ...blank, optChoice: 'skip' }), null)
})

test('변 상태 — 고르지 않고도 "잘 모르겠어요"를 명시적으로 누르면 통과, 아무것도 안 누르면 막힘', () => {
  assert.ok(screenError('stool', blank))
  assert.equal(screenError('stool', { ...blank, stoolSkipped: true }), null)
  assert.equal(screenError('stool', { ...blank, bristol: 4 }), null)
})

test('알레르기 — "있어요"인데 재료를 안 고르면 막힘, "잘 몰라요"는 통과', () => {
  assert.equal(screenError('allergy', { ...blank, dlMode: 'unknown' }), null)
  assert.ok(screenError('allergy', { ...blank, dlMode: 'has' }))
  assert.equal(screenError('allergy', { ...blank, dlMode: 'has', allergies: ['계란'] }), null)
})

test('질환 — "있어요"인데 질환도 처방식도 없으면 막힘, 처방식만 적어도 통과, "없어요"는 통과', () => {
  assert.equal(screenError('chronic', { ...blank, hasChronic: 'no' }), null)
  assert.ok(screenError('chronic', { ...blank, hasChronic: 'yes' }))
  assert.equal(screenError('chronic', { ...blank, hasChronic: 'yes', chronicConditions: ['kidney'] }), null)
  assert.equal(screenError('chronic', { ...blank, hasChronic: 'yes', prescriptionDiet: 'Renal' }), null)
})

test('옛 초안 currentStep → 새 화면 (7일 내 복귀자가 처음부터 다시 안 하도록)', () => {
  assert.equal(legacyStepToScreen('body'), 'ribs')
  assert.equal(legacyStepToScreen('meal'), 'food')
  assert.equal(legacyStepToScreen('diet'), 'food')
  assert.equal(legacyStepToScreen('status'), 'goal')
  assert.equal(legacyStepToScreen('loading'), 'goal')
  assert.equal(legacyStepToScreen('budget'), 'ribs')
  assert.ok(isScreenKey('optMeds'))
  assert.ok(!isScreenKey('loading'))
  assert.ok(!isScreenKey('budget'))
})
