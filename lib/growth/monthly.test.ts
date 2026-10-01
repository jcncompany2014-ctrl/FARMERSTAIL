import { test } from 'node:test'
import assert from 'node:assert/strict'
import { growthAnalysisRow, growthPushCopy, planMonthlyGrowth, type GrowthDog } from './monthly.ts'

const kkong: GrowthDog = {
  id: 'dog-kk',
  name: '낑콩',
  weight: 1.5,
  birth_date: '2026-05-06',
  neutered: false,
  activity_level: null,
  gender: 'female',
  breed: '말티푸',
  weight_measured_at: '2026-09-30T14:34:23Z',
}
const answers = { bcsExact: 5, bodyCondition: 'ideal', snackFreq: '가끔', allergies: [], healthConcerns: [] }
const last = { created_at: '2026-09-30T14:34:23Z', stage: '성장기 (퍼피)', weight_kg: null }
const at = (iso: string) => Date.parse(iso)

test('30일이 안 됐으면 건너뛴다 — 새 분석 행이 "이번 달 처리함" 표식(알림 중복 없음)', () => {
  const p = planMonthlyGrowth({ dog: kkong, lastAnalysis: last, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-10-20T00:30:00Z') })
  assert.deepEqual(p, { due: false, reason: 'not_due' })
})

test('성견 분석이면 대상 아님 · 생일·분석 없으면 대상 아님', () => {
  assert.equal(planMonthlyGrowth({ dog: kkong, lastAnalysis: { ...last, stage: '성견 (유지기)' }, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-11-01T00:30:00Z') }).due, false)
  assert.equal(planMonthlyGrowth({ dog: { ...kkong, birth_date: null }, lastAnalysis: last, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-11-01T00:30:00Z') }).due, false)
  assert.equal(planMonthlyGrowth({ dog: kkong, lastAnalysis: null, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-11-01T00:30:00Z') }).due, false)
})

test('체중 기록이 없으면 성장곡선으로 이번 달 체중을 추정 — 실측보다 작게 추정하지 않고, 칼로리가 오른다', () => {
  const p = planMonthlyGrowth({ dog: kkong, lastAnalysis: last, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-11-01T00:30:00Z') })
  assert.ok(p.due)
  assert.equal(p.weightSource, 'estimated')
  assert.equal(p.prevWeightKg, 1.5)
  assert.ok(p.weightKg > 1.5 && p.weightKg < 2.2, `${p.weightKg}`)
  assert.ok(p.nutrition.mer > 218, `한 달 자란 만큼 칼로리 ↑ (${p.nutrition.mer})`)
  assert.equal(p.grownUp, false)
  const c = growthPushCopy(kkong, p)
  assert.equal(c.title, '낑콩이 한 달 성장 소식')
  assert.match(c.body, /^이맘때면 1\.5kg에서 약 1\.\dkg쯤 컸을 거예요\./)
  assert.equal(c.url, '/dogs/dog-kk?weight=open')
  assert.doesNotMatch(`${c.title}${c.body}`, /%|언제든/)
})

test('지난 분석 뒤 체중 기록이 있으면 그 실측으로 — "○kg에서 ○kg이 됐어요", 분석 화면으로', () => {
  const p = planMonthlyGrowth({
    dog: { ...kkong, weight: 1.9 },
    lastAnalysis: { ...last, weight_kg: 1.5 },
    surveyAnswers: answers,
    latestWeightLog: { weight: 1.9, measured_at: '2026-10-25' },
    nowMs: at('2026-11-01T00:30:00Z'),
  })
  assert.ok(p.due)
  assert.equal(p.weightSource, 'logged')
  assert.equal(p.weightKg, 1.9)
  const c = growthPushCopy(kkong, p)
  assert.equal(c.body, '몸무게가 1.5kg에서 1.9kg이 됐어요. 자란 만큼 하루 권장 급여량을 다시 계산했어요.')
  assert.equal(c.url, '/dogs/dog-kk/analysis')
})

test('성장기를 지나면 성견 기준으로 한 번 넘어가고 알림도 그렇게 말한다', () => {
  const p = planMonthlyGrowth({
    dog: kkong,
    lastAnalysis: { ...last, created_at: '2027-04-01T00:00:00Z', weight_kg: 2.4 },
    surveyAnswers: answers,
    latestWeightLog: null,
    nowMs: at('2027-05-10T00:30:00Z'),
  })
  assert.ok(p.due)
  assert.equal(p.grownUp, true)
  assert.equal(p.nutrition.stage, 'adult')
  assert.match(growthPushCopy(kkong, p).body, /다 자랐어요/)
})

test('자동 갱신 분석 행 — source growth_auto · 쓴 몸무게 · 설문 분석과 같은 칸', () => {
  const p = planMonthlyGrowth({ dog: kkong, lastAnalysis: last, surveyAnswers: answers, latestWeightLog: null, nowMs: at('2026-11-01T00:30:00Z') })
  assert.ok(p.due)
  const row = growthAnalysisRow({ dogId: 'dog-kk', userId: 'u1', surveyId: 's1', plan: p, supplements: ['기본 종합비타민/미네랄'], nextReviewDate: '2026-12-29' })
  assert.equal(row.source, 'growth_auto')
  assert.equal(row.weight_kg, p.weightKg)
  assert.equal(row.mer, p.nutrition.mer)
  assert.equal(row.survey_id, 's1')
  for (const k of ['rer', 'factor', 'stage', 'feed_g', 'micronutrients', 'factor_breakdown', 'guideline_version', 'risk_flags']) assert.ok(k in row, k)
})
