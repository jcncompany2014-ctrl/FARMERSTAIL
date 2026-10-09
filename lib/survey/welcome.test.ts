/**
 * survey/welcome — 가입 직후 설문 첫 질문 '가입 완료' 띠 판정(2026-10-09 캔버스 Y7).
 * 기존 회원에게 '가입 완료!'가 뜨지 않게, 시각을 못 읽으면 안 띄우게.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isFreshAccount, surveyStartHref, WELCOME_PARAM } from './welcome.ts'

const NOW = Date.parse('2026-10-10T00:00:00Z')
const DAY = 86_400_000

describe('survey/welcome', () => {
  it('방금 만든 계정만 가입 직후로 본다(7일 안)', () => {
    assert.equal(isFreshAccount(new Date(NOW - 5 * 60_000).toISOString(), NOW), true)
    assert.equal(isFreshAccount(new Date(NOW - 6 * DAY).toISOString(), NOW), true, '메일 인증을 며칠 뒤에 해도 방금 가입')
    assert.equal(isFreshAccount(new Date(NOW - 8 * DAY).toISOString(), NOW), false, '오래된 계정(기존 회원)은 아니다')
  })

  it('시각을 못 읽으면 아니라고 본다', () => {
    assert.equal(isFreshAccount(undefined, NOW), false)
    assert.equal(isFreshAccount(null, NOW), false)
    assert.equal(isFreshAccount('', NOW), false)
    assert.equal(isFreshAccount('어제', NOW), false)
  })

  it('기기 시계가 조금 느린 건 봐준다(1분까지)', () => {
    assert.equal(isFreshAccount(new Date(NOW + 30_000).toISOString(), NOW), true)
    assert.equal(isFreshAccount(new Date(NOW + 10 * 60_000).toISOString(), NOW), false)
  })

  it('설문 첫 주소', () => {
    assert.equal(surveyStartHref('abc', true), `/dogs/abc/survey?${WELCOME_PARAM}=1`)
    assert.equal(surveyStartHref('abc', false), '/dogs/abc/survey')
  })
})
