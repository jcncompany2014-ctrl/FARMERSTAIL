import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeAnalysis,
  describeBox,
  describeSurvey,
  surveyChips,
  surveyOrigin,
} from './labels.ts'

const v4 = {
  housing: 'indoor',
  bcsExact: 4,
  careGoal: 'weight_management',
  foodType: '습식/화식',
  allergies: [],
  snackFreq: '가끔',
  bristolScore: 4,
  isEasyKeeper: false,
  bodyCondition: 'slim',
  giSensitivity: 'rare',
  surveyVersion: 4,
  bodyAssessment: { ribs: 'easy', waist: 'clear', abdomen: 'tucked' },
  healthConcerns: [],
  indoorActivity: 'moderate',
  weightTrend6mo: 'lost',
  optionalSkipped: false,
  currentFoodBrand: '순환급여 중',
  dailyWalkMinutes: 60,
  vigorousExercise: 'none',
  chronicConditions: ['long_term_steroid'],
  preferredProteins: [],
  currentMedications: ['스테로이드 복용중', '9월 30일 항암 시작'],
  homeCookingExperience: 'frequent',
}

test('앱 v4 답변 → 한글 섹션 (고객이 누른 글자 그대로)', () => {
  assert.equal(surveyOrigin(v4), 'app_v4')
  const s = describeSurvey(v4, { current_medications: v4.currentMedications, daily_walk_minutes: 60 })
  const flat = Object.fromEntries(s.flatMap((sec) => sec.items.map((i) => [i.label, i.value])))
  assert.equal(flat['갈비뼈'], '살짝 만지면 느껴져요')
  assert.equal(flat['허리'], '잘록하게 들어가요')
  assert.equal(flat['배'], '위로 올라가요')
  assert.equal(flat['체형'], '4단계 (9단계 중) · 약간 말랐어요')
  assert.equal(flat['최근 6개월 체중'], '빠졌어요')
  assert.equal(flat['살이 잘 찌는 편'], '아니요')
  assert.equal(flat['변 상태'], '적당해요 (이상적)')
  assert.equal(flat['주식'], '습식/화식')
  assert.equal(flat['화식 경험'], '자주 (일주일에 1번 이상)')
  assert.equal(flat['피해야 할 재료'], '없음')
  assert.equal(flat['진단받은 질환'], '장기 스테로이드 복용')
  assert.equal(flat['먹는 약·보충제'], '스테로이드 복용중 / 9월 30일 항암 시작')
  assert.equal(flat['하루 산책'], '하루 2번 이상')
  assert.equal(flat['격한 운동'], '안 해요')
  assert.equal(flat['가장 신경 쓰고 싶은 것'], '체중 관리')
  assert.equal(flat['추가 질문 4개'], '답함')
  // 영어 키가 그대로 새어 나오지 않는다
  for (const sec of s) for (const i of sec.items) assert.doesNotMatch(i.value, /^[a-z_]+$/, `${i.label}: ${i.value}`)
  assert.deepEqual(surveyChips(v4, { current_medications: v4.currentMedications }), ['체형 4/9', '체중 빠졌어요', '습식/화식', '질환 1', '약 2', '체중 관리'])
})

test('웹 1분 설문(체형 5지선다·영문 키) 도 읽힌다', () => {
  const web = { bodyCondition: 'chubby', allergies: ['chicken', 'beef'], healthConcerns: ['joint', 'skin'], foodType: 'kibble', appetite: 'picky' }
  assert.equal(surveyOrigin(web), 'web')
  const flat = Object.fromEntries(describeSurvey(web).flatMap((sec) => sec.items.map((i) => [i.label, i.value])))
  assert.equal(flat['체형'], '약간 통통해요')
  assert.equal(flat['주식'], '사료 (건식)')
  assert.equal(flat['피해야 할 재료'], '닭 · 소')
  assert.equal(flat['관심사(웹 설문)'], '관절 · 피부·털')
  assert.equal(flat['입맛(옛 설문)'], '까다로워요')
  assert.deepEqual(surveyChips(web), ['체형 약간 통통해요', '사료 (건식)', '알레르기 2'])
})

test('앱 v3(모질·식욕·MCS 있던 버전) 과 깨진 값도 throw 없이', () => {
  const v3 = { bcsExact: 6, bodyCondition: 'chubby', coatCondition: 'itchy', appetite: 'strong', mcsScore: 2, careGoal: 'skin_coat', allergies: ['계란'], chronicConditions: [] }
  assert.equal(surveyOrigin(v3), 'app_v3')
  const flat = Object.fromEntries(describeSurvey(v3).flatMap((sec) => sec.items.map((i) => [i.label, i.value])))
  assert.equal(flat['모질·피부(옛 설문)'], '가려움')
  assert.equal(flat['근육 상태(옛 설문)'], '2 / 4')
  assert.equal(flat['진단받은 질환'], '없음')
  assert.deepEqual(describeSurvey(null), [])
  assert.deepEqual(describeSurvey('garbage'), [])
  // 깨진 값: 체형·체형 3분해는 버리고, allergies 키가 있으니 '없음' 한 줄만 남는다.
  const junk = describeSurvey({ bcsExact: 'x', bodyAssessment: 7, allergies: 'no' })
  assert.deepEqual(junk.map((s) => s.title), ['알레르기'])
  assert.deepEqual(junk[0]!.items.map((i) => i.value), ['없음'])
})

test('분석 → 계수 사다리·리스크 한글', () => {
  const a = describeAnalysis({
    rer: '423', mer: '550', factor: '1.3',
    factor_breakdown: [{ delta: 1.4, label: '기본(중성화 성견·실내·저활동)' }, { delta: -0.1, label: '쉽게 찌는 체질/비만경향 견종' }],
    feed_g: '398', bcs_score: 4, protein_pct: '32', fat_pct: '16', risk_flags: ['STEROID_SIDE_EFFECTS', 'UNKNOWN_X'], vet_consult_recommended: true, supplements: ['오메가-3'], next_review_date: '2026-11-23',
  })
  assert.ok(a)
  assert.equal(a!.mer, 550)
  assert.deepEqual(a!.ladder.map((l) => l.delta), [1.4, -0.1])
  assert.deepEqual(a!.riskFlags, ['스테로이드 부작용 주의', 'UNKNOWN_X'])
  assert.equal(a!.vetConsult, true)
  assert.equal(a!.macros, '단백질 32% · 지방 16%')
  assert.equal(describeAnalysis(null), null)
})

test('추천 박스 — 표시 박스는 lineRatios(정본) 를 고객 카드와 같은 규칙으로 스냅, 엔진 초안 비율은 안 쓴다', () => {
  const withPicks = describeBox({
    formula: { v3: { layerA: { picks: [{ nameKr: '치킨', protein: 'chicken', ratio: 1, kcalPer100g: 130, claims: [{ text: '단백질이 진함' }] }], trace: [{ step: '주 SKU', detail: '치킨' }], needsConsultation: false }, layerB: { waitlistConcerns: ['joint'] } }, lineRatios: { weight: 1 } },
    reasoning: [{ chipLabel: '첫 박스는 한 가지로', action: '치킨 단독 100%', trigger: '첫 박스' }],
    daily_kcal: 523, daily_grams: 402, cycle_number: 1, approval_status: 'auto_applied',
  })
  assert.ok(withPicks)
  assert.deepEqual(withPicks!.picks.map((p) => [p.name, p.ratio]), [['치킨', 1]])
  assert.deepEqual(withPicks!.picks[0]!.claims, ['단백질이 진함'])
  assert.equal(withPicks!.picks[0]!.kcalPer100g, 130)
  assert.equal(withPicks!.engineDraft, null)
  assert.deepEqual(withPicks!.chips, ['첫 박스는 한 가지로'])
  assert.deepEqual(withPicks!.trace, ['주 SKU: 치킨'])
  assert.deepEqual(withPicks!.waitlist, ['joint'])
  assert.equal(withPicks!.dailyGrams, 402)

  // 2026-09-24 사장님 제보: 땅콩(12kg) 카드가 "치킨 70% · 흑돼지 30%" — 우리 박스에 30% 는 없다.
  // 실제 저장 박스(lineRatios)는 치킨 100% 였고, 엔진 초안(v3 picks)을 그대로 그린 게 원인.
  const draft7030 = describeBox({
    formula: {
      v3: { layerA: { picks: [{ nameKr: '치킨', protein: 'chicken', ratio: 0.7, kcalPer100g: 130, claims: [{ text: '단백질이 진함' }] }, { nameKr: '흑돼지', protein: 'pork', ratio: 0.3, kcalPer100g: 125, claims: [] }] } },
      lineRatios: { skin: 0, basic: 0, joint: 0, weight: 1, premium: 0 },
    },
    reasoning: [{ chipLabel: '첫 박스는 한 가지로', action: '치킨 단독 100%', trigger: '첫 박스' }],
  })
  assert.deepEqual(draft7030!.picks.map((p) => [p.name, p.ratio]), [['치킨', 1]])
  assert.equal(draft7030!.picks[0]!.kcalPer100g, 130, '초안의 kcal·근거 문구는 같은 레시피에 붙여 준다')
  assert.equal(draft7030!.engineDraft, '치킨 70% · 흑돼지 30%')

  // lineRatios 가 아예 없는 행(깨진/옛 데이터)이라도 초안을 같은 규칙으로 스냅 — 70/30 은 절대 안 나온다.
  const draftOnly = describeBox({ formula: { v3: { layerA: { picks: [{ protein: 'chicken', ratio: 0.7 }, { protein: 'pork', ratio: 0.3 }] } } } })
  assert.deepEqual(draftOnly!.picks.map((p) => [p.name, p.ratio]), [['치킨', 0.5], ['흑돼지', 0.5]])

  // 옛 처방(v3 없음): 2종이면 50:50, 2번째가 20% 미만이면 1종 100% — boxComposition.SECOND_LINE_MIN 과 동일.
  const legacy = describeBox({ formula: { lineRatios: { basic: 0.5, premium: 0.4, joint: 0.1 } }, reasoning: [] })
  assert.deepEqual(legacy!.picks.map((p) => [p.name, p.ratio]), [['오리', 0.5], ['한우', 0.5]])
  const single = describeBox({ formula: { lineRatios: { weight: 0.85, joint: 0.15 } } })
  assert.deepEqual(single!.picks.map((p) => [p.name, p.ratio]), [['치킨', 1]])

  // 불변식: 어떤 입력이든 표시 비율은 100% 아니면 50% 뿐.
  for (const b of [withPicks, draft7030, draftOnly, legacy, single]) {
    for (const p of b!.picks) assert.ok(p.ratio === 1 || p.ratio === 0.5, `${p.name} ${p.ratio}`)
  }
  assert.equal(describeBox(null), null)
})
