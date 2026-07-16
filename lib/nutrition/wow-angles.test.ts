import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildWowAngles, birthdayInfo, type WowAngleInput } from './wow-angles.ts'

const BASE: WowAngleInput = {
  bcsScore: 5,
  prevBcsScore: null,
  feedG: 200,
  prevFeedG: null,
  stage: '성견',
  prevStage: null,
  daysSinceLast: null,
  daysUntilBirthday: null,
  turningAge: null,
}

describe('buildWowAngles — 시계열', () => {
  test('첫 분석(prev 없음)이면 시계열 앵글 없음', () => {
    const a = buildWowAngles(BASE)
    assert.equal(a.some((x) => x.kind === 'timeseries'), false)
  })

  test('BCS 6→5 (이상 체형에 가까워짐) → toward 문구', () => {
    const a = buildWowAngles({
      ...BASE,
      bcsScore: 5,
      prevBcsScore: 6,
      daysSinceLast: 21,
    })
    const ts = a.find((x) => x.kind === 'timeseries')
    assert.ok(ts)
    assert.match(ts.fact, /가까워졌어요/)
    assert.match(ts.fact, /약 3주 전/)
  })

  test('BCS 5→7 (이상에서 멀어짐) → 멀어졌다 경고 문구', () => {
    const a = buildWowAngles({
      ...BASE,
      bcsScore: 7,
      prevBcsScore: 5,
      daysSinceLast: 30,
    })
    const ts = a.find((x) => x.kind === 'timeseries')
    assert.ok(ts)
    assert.match(ts.fact, /멀어졌어요/)
  })

  test('BCS 동일하지만 급여량 10%↑ → 급여량 조정 앵글', () => {
    const a = buildWowAngles({
      ...BASE,
      bcsScore: 5,
      prevBcsScore: 5,
      feedG: 220,
      prevFeedG: 200,
      daysSinceLast: 14,
    })
    const ts = a.find((x) => x.kind === 'timeseries')
    assert.ok(ts)
    assert.match(ts.fact, /\+10%/)
  })

  test('급여량 변화 5% 미만이면 앵글 없음(노이즈 억제)', () => {
    const a = buildWowAngles({
      ...BASE,
      bcsScore: 5,
      prevBcsScore: 5,
      feedG: 204,
      prevFeedG: 200,
      daysSinceLast: 14,
    })
    assert.equal(a.some((x) => x.kind === 'timeseries'), false)
  })

  test('daysSinceLast=0 이면 시계열 없음(같은 날 재분석)', () => {
    const a = buildWowAngles({
      ...BASE,
      bcsScore: 5,
      prevBcsScore: 7,
      daysSinceLast: 0,
    })
    assert.equal(a.some((x) => x.kind === 'timeseries'), false)
  })
})

describe('buildWowAngles — 생애주기 전환', () => {
  test('성견→노령견 전환 → stage 앵글', () => {
    const a = buildWowAngles({ ...BASE, stage: '노령견', prevStage: '성견' })
    const s = a.find((x) => x.kind === 'stage')
    assert.ok(s)
    assert.match(s.fact, /'성견'에서 '노령견'/)
  })

  test('stage 동일하면 앵글 없음', () => {
    const a = buildWowAngles({ ...BASE, stage: '성견', prevStage: '성견' })
    assert.equal(a.some((x) => x.kind === 'stage'), false)
  })
})

describe('buildWowAngles — 생일', () => {
  test('12일 뒤 생일 → birthday 앵글 + 나이', () => {
    const a = buildWowAngles({ ...BASE, daysUntilBirthday: 12, turningAge: 3 })
    const b = a.find((x) => x.kind === 'birthday')
    assert.ok(b)
    assert.match(b.fact, /12일 뒤/)
    assert.match(b.fact, /3살/)
  })

  test('오늘 생일 → 오늘 문구', () => {
    const a = buildWowAngles({ ...BASE, daysUntilBirthday: 0, turningAge: 2 })
    const b = a.find((x) => x.kind === 'birthday')
    assert.ok(b)
    assert.match(b.fact, /오늘이 생일/)
  })

  test('31일 뒤 생일이면 앵글 없음(범위 밖)', () => {
    const a = buildWowAngles({ ...BASE, daysUntilBirthday: 31, turningAge: 2 })
    assert.equal(a.some((x) => x.kind === 'birthday'), false)
  })
})

describe('birthdayInfo — 순수 D-day 계산', () => {
  // 기준: 2026-07-16 (UTC)
  const NOW = Date.UTC(2026, 6, 16)

  test('null/빈 입력 → null', () => {
    assert.equal(birthdayInfo(null, NOW), null)
    assert.equal(birthdayInfo('not-a-date', NOW), null)
  })

  test('생일이 12일 뒤(7/28), 2023년생 → 2026 생일에 3살', () => {
    const r = birthdayInfo('2023-07-28', NOW)
    assert.ok(r)
    assert.equal(r.daysUntil, 12)
    assert.equal(r.turningAge, 3)
  })

  test('생일이 오늘(7/16) → daysUntil 0', () => {
    const r = birthdayInfo('2024-07-16', NOW)
    assert.ok(r)
    assert.equal(r.daysUntil, 0)
    assert.equal(r.turningAge, 2)
  })

  test('생일이 이미 지남(7/1) → 내년으로 롤오버', () => {
    const r = birthdayInfo('2022-07-01', NOW)
    assert.ok(r)
    // 2027-07-01 까지 350일
    assert.ok(r.daysUntil > 340 && r.daysUntil < 360)
    assert.equal(r.turningAge, 5) // 2027 - 2022
  })
})
