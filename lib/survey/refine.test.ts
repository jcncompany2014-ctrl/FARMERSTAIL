import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optionalSkipped, seedFromSurvey } from './refine.ts'

const v4Row = {
  answers: {
    bodyCondition: 'ideal',
    allergies: ['소고기'],
    healthConcerns: [],
    foodType: '건식 사료',
    snackFreq: '가끔',
    bcsExact: 5,
    bodyAssessment: { ribs: 'easy', waist: 'clear', abdomen: 'level' },
    bristolScore: 4,
    chronicConditions: ['kidney'],
    currentMedications: [],
    pregnancyStatus: 'none',
    isEasyKeeper: false,
    vigorousExercise: 'self_report',
    housing: 'outdoor',
    coldExposure: true,
    kibbleKcalPer100g: 350,
    treatKcalPerDay: 50,
    careGoal: 'general_upgrade',
    homeCookingExperience: 'first',
    weightTrend6mo: 'stable',
    giSensitivity: 'sometimes',
    preferredProteins: ['duck'],
    indoorActivity: 'active',
    diagnosedSeverity: { pancreatitis: 'severe' },
    optionalSkipped: true,
    surveyVersion: 4,
  },
  iris_stage: 2,
  current_medications: ['글루코사민', '오메가-3'],
  current_food_brand: '로얄캐닌 미니',
  daily_walk_minutes: 30,
  indoor_activity: 'active',
  expected_adult_weight_kg: null,
  pregnancy_week: null,
  litter_size: null,
  prescription_diet: '레날',
}

test('optionalSkipped — v4 플래그가 true 인 행만 true. v3 행(플래그 없음)·빈 행은 false', () => {
  assert.equal(optionalSkipped(v4Row), true)
  assert.equal(optionalSkipped({ answers: { ...v4Row.answers, optionalSkipped: false } }), false)
  assert.equal(optionalSkipped({ answers: { bodyCondition: 'ideal', allergies: [] } }), false)
  assert.equal(optionalSkipped({ answers: null }), false)
  assert.equal(optionalSkipped(null), false)
  assert.equal(optionalSkipped({ answers: 'garbage' }), false)
})

test('seedFromSurvey — 마지막 설문의 답이 SurveyClient 상태 모양으로 돌아온다', () => {
  const s = seedFromSurvey(v4Row)
  assert.deepEqual(s.bodyAssess, { ribs: 'easy', waist: 'clear', abdomen: 'level' })
  assert.equal(s.bcs, 5)
  assert.equal(s.weightTrend, 'stable')
  assert.equal(s.easyKeeper, 'no')
  assert.equal(s.bristol, 4)
  assert.equal(s.stoolSkipped, false)
  assert.equal(s.giSensitivity, 'sometimes')
  assert.equal(s.foodType, '건식 사료')
  assert.equal(s.snackFreq, '가끔')
  assert.equal(s.treatKcal, '50')
  // answers 는 /100g, 화면 입력은 kcal/kg
  assert.equal(s.kibbleKcal, '3500')
  assert.equal(s.currentBrand, '로얄캐닌 미니')
  assert.equal(s.homeCookingExp, 'first')
  assert.equal(s.walkMinutes, '30')
  assert.equal(s.indoorActivity, 'active')
  // 저장 'self_report' → 화면 'self'
  assert.equal(s.vigorous, 'self')
  assert.equal(s.housing, 'outdoor')
  assert.equal(s.coldOutdoor, 'yes')
  assert.equal(s.dlMode, 'has')
  assert.deepEqual(s.allergies, ['소고기'])
  assert.deepEqual(s.preferredProteins, ['duck'])
  assert.equal(s.hasChronic, 'yes')
  assert.deepEqual(s.chronicConditions, ['kidney'])
  assert.equal(s.prescriptionDiet, '레날')
  assert.equal(s.medications, '글루코사민, 오메가-3')
  assert.equal(s.irisStage, 2)
  assert.equal(s.pancreatitisSeverity, 'severe')
  assert.equal(s.pregnancy, 'none')
  assert.equal(s.careGoal, 'general_upgrade')
})

test('seedFromSurvey — 빈/깨진 행은 전부 미응답으로 (throw 하지 않는다)', () => {
  const s = seedFromSurvey({ answers: null })
  assert.deepEqual(s.bodyAssess, { ribs: '', waist: '', abdomen: '' })
  assert.equal(s.bcs, null)
  assert.equal(s.bristol, null)
  // 변 점수가 없으면 "잘 모르겠어요"를 눌렀던 것으로 — 필수 판정이 그 화면에서 막지 않게
  assert.equal(s.stoolSkipped, true)
  assert.equal(s.dlMode, 'none')
  assert.equal(s.hasChronic, 'no')
  assert.equal(s.medications, '')
  assert.equal(s.kibbleKcal, '')
  const junk = seedFromSurvey({ answers: { bcsExact: 42, bristolScore: 'x', bodyAssessment: 'nope', vigorousExercise: 'crazy' }, iris_stage: 9 })
  assert.equal(junk.bcs, null)
  assert.equal(junk.bristol, null)
  assert.equal(junk.vigorous, '')
  assert.equal(junk.irisStage, null)
})
