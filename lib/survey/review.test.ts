import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScreens } from './flow.ts'
import { reviewRows, type ReviewState } from './review.ts'

// 낑콩이(10/21) 지난 답과 같은 모양.
const S: ReviewState = {
  bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: 'tucked' },
  weightTrend: 'gained',
  easyKeeper: 'no',
  bristol: 6,
  stoolSkipped: false,
  giSensitivity: '',
  foodType: '반반',
  snackFreq: '가끔',
  treatKcal: '',
  homeCookingExp: 'frequent',
  allergies: [],
  preferredProteins: ['chicken', 'duck'],
  hasChronic: 'no',
  chronicConditions: [],
  prescriptionDiet: '',
  pregnancy: '',
  careGoal: 'general_upgrade',
  currentBrand: '로얄캐닌',
  kibbleKcal: '',
  walkMinutes: '30',
  indoorActivity: 'active',
  vigorous: 'self',
  housing: 'indoor',
  medications: '',
}
const BOY = { gender: 'male' as const, neutered: true, ageMonths: 36 }

test('다시 하기 요약: 체형 세 화면은 한 줄 · 관문 없음 · 선택 묶음까지 · 설문 보기와 같은 말', () => {
  const rows = reviewRows(buildScreens(BOY, 'answer'), S)
  assert.deepEqual(rows[0]!.keys, ['ribs', 'waist', 'abdomen'])
  assert.equal(rows[0]!.title, '체형')
  assert.match(rows[0]!.value, /갈비뼈 살짝 만지면 느껴져요/)
  assert.ok(!rows.some((r) => r.keys.includes('gate')), '관문이 요약에 나왔다')
  assert.ok(!rows.some((r) => r.keys[0] === 'waist' || r.keys[0] === 'abdomen'), '허리·배가 따로 줄을 만들었다')
  const titles = rows.map((r) => r.title)
  for (const t of ['최근 체중 변화', '변 상태', '지금 먹는 밥', '간식', '알레르기·잘 먹는 고기', '앓는 병', '바라는 것', '먹는 약']) {
    assert.ok(titles.includes(t), `${t} 줄이 없다`)
  }
  assert.equal(rows.find((r) => r.title === '운동·사는 곳')!.value, '숨찬 운동 해요 (느낌상) · 실내')
  assert.ok(!rows.some((r) => r.empty), `빈 답으로 보이는 줄: ${rows.filter((r) => r.empty).map((r) => r.title).join(', ')}`)
  // 수컷·중성화 → 임신 줄 없음
  assert.ok(!titles.includes('임신·수유'))
})

test('다시 하기 요약: 지난번엔 없던 질문(빈 답)은 빈 줄로 표시 — 그대로 저장하지 않게', () => {
  const rows = reviewRows(buildScreens(BOY, 'answer'), { ...S, homeCookingExp: '', bodyAssess: { ribs: 'easy', waist: '', abdomen: 'tucked' } })
  const empty = rows.filter((r) => r.empty).map((r) => r.title)
  assert.deepEqual(empty, ['체형', '화식 먹여 본 경험'])
})
