import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isGrowingDog } from './growing.ts'

/** 성장기 판정 — 체중 경보 크론들이 같은 조건으로 뺀다(2026-10-13 점검 E3). */
test('12개월 미만이면 성장기', () => {
  assert.equal(isGrowingDog({ ageValue: 5, ageUnit: 'months' }), true)
  assert.equal(isGrowingDog({ ageValue: 11, ageUnit: 'months', latestStage: '성견 (유지기)' }), true)
  assert.equal(isGrowingDog({ ageValue: 1, ageUnit: 'years' }), false, '12개월 = 성장기 아님')
})

test('마지막 분석이 성장기(퍼피)면 나이와 상관없이 성장기', () => {
  assert.equal(isGrowingDog({ ageValue: 14, ageUnit: 'months', latestStage: '퍼피 (성장기)' }), true)
  assert.equal(isGrowingDog({ ageValue: null, ageUnit: null, latestStage: '성장기' }), true)
})

test('나이도 단계도 모르면 성장기 아님', () => {
  assert.equal(isGrowingDog({ ageValue: null, ageUnit: null }), false)
  assert.equal(isGrowingDog({ ageValue: 3, ageUnit: 'years', latestStage: '시니어' }), false)
})
