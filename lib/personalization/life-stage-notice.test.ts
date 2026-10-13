import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIFE_STAGE_VET_NOTICE, needsLifeStageVetNotice } from './life-stage-notice.ts'

/** 아기·임신·수유 안내(2026-10-13 점검 E11) — 추천 앞에서 사실을 말한다. */
test('아기 강아지·임신·수유면 안내', () => {
  assert.equal(needsLifeStageVetNotice('퍼피 (성장기)', []), true)
  assert.equal(needsLifeStageVetNotice('성견 (유지기)', ['PREGNANT']), true)
  assert.equal(needsLifeStageVetNotice('성견', ['LACTATING']), true)
})

test('성견·시니어는 안내 없음', () => {
  assert.equal(needsLifeStageVetNotice('성견 (유지기)', ['OVERWEIGHT']), false)
  assert.equal(needsLifeStageVetNotice('시니어', null), false)
  assert.equal(needsLifeStageVetNotice(null, undefined), false)
})

test('문구 — 성견 유지용 사실 + 수의사 상의, 금지어 없음', () => {
  assert.match(LIFE_STAGE_VET_NOTICE, /성견 유지용/)
  assert.match(LIFE_STAGE_VET_NOTICE, /수의사/)
  assert.doesNotMatch(LIFE_STAGE_VET_NOTICE, /처방|맞춤|언제든/)
})
