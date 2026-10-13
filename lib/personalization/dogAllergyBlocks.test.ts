import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allergiesFromAnswers,
  blockedLinesByDogFromSurveys,
  loadBlockedLinesByDog,
  loadDogBlockedLines,
} from './dogAllergyBlocks.ts'
import { blockedLinesForAllergies } from './skuMap.ts'

/** 강아지별 최신 설문 알레르기 → 막힌 라인(2026-10-13 점검 E1). */
test('정본 표 — 한우는 소고기·양고기, 치킨은 닭·칠면조, 옛 연어 라벨도 막는다', () => {
  assert.deepEqual(blockedLinesForAllergies(['양고기']), ['premium'])
  assert.deepEqual(blockedLinesForAllergies(['닭·칠면조', '오리']), ['basic', 'weight'])
  assert.deepEqual(blockedLinesForAllergies(['연어·생선']), ['skin'])
  assert.deepEqual(blockedLinesForAllergies([]), [])
  assert.deepEqual(blockedLinesForAllergies(null), [])
})

test('answers 모양이 이상하면 빈 배열(문자열만 남긴다)', () => {
  assert.deepEqual(allergiesFromAnswers({ allergies: ['오리', 3, null] }), ['오리'])
  assert.deepEqual(allergiesFromAnswers({ allergies: '오리' }), [])
  assert.deepEqual(allergiesFromAnswers(null), [])
})

test('강아지별 **최신** 설문 — 호출처 정렬에 기대지 않는다', () => {
  const m = blockedLinesByDogFromSurveys([
    { dog_id: 'a', answers: { allergies: ['오리'] }, created_at: '2026-09-01T00:00:00Z' },
    { dog_id: 'a', answers: { allergies: ['소고기'] }, created_at: '2026-10-01T00:00:00Z' },
    { dog_id: 'b', answers: {}, created_at: '2026-10-01T00:00:00Z' },
  ])
  assert.deepEqual(m.get('a'), ['premium'], '새 설문(소고기)이 이긴다')
  assert.deepEqual(m.get('b'), [])
  assert.equal(m.has('c'), false)
})

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        in: () => ({ order: () => Promise.resolve(result) }),
      }),
    }),
  }
}

test('조회 실패는 "알레르기 없음"이 아니다 — ok:false(규칙1)', async () => {
  const r = await loadBlockedLinesByDog(fakeClient({ data: null, error: { message: 'boom' } }), ['a'])
  assert.equal(r.ok, false)
  const one = await loadDogBlockedLines(fakeClient({ data: null, error: { message: 'boom' } }), 'a')
  assert.equal(one.ok, false)
})

test('정상 조회 — 한 마리', async () => {
  const r = await loadDogBlockedLines(
    fakeClient({ data: [{ dog_id: 'a', answers: { allergies: ['닭·칠면조'] }, created_at: '2026-10-01T00:00:00Z' }], error: null }),
    'a',
  )
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.blockedLines, ['weight'])
})
