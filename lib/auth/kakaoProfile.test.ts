/**
 * kakaoProfile — 카카오 OAuth 메타데이터 파서 회귀 테스트.
 *
 * ★실제 카카오→Supabase 메타데이터 키는 스코프 승인 후 실기기로 확정. 이 테스트는
 *   현재 다루는 후보 shape(직속 / kakao_account 중첩)와 정규화 로직을 고정한다 —
 *   승인 후 실제 키가 다르면 deepGet 후보 목록만 넓히고 이 테스트에 케이스 추가.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickKakaoBirthYear, pickKakaoPhone } from './kakaoProfile.ts'

const NOW = 2026

describe('pickKakaoBirthYear', () => {
  it('직속 birthyear(문자열) → 정수', () => {
    assert.equal(pickKakaoBirthYear({ birthyear: '1990' }, NOW), 1990)
  })
  it('kakao_account 중첩', () => {
    assert.equal(
      pickKakaoBirthYear({ kakao_account: { birthyear: '1985' } }, NOW),
      1985,
    )
  })
  it('birth_year(숫자) 대체 키', () => {
    assert.equal(pickKakaoBirthYear({ birth_year: 2000 }, NOW), 2000)
  })
  it('만 14세 미만 → null(age-gate 가 처리)', () => {
    assert.equal(pickKakaoBirthYear({ birthyear: String(NOW - 10) }, NOW), null)
  })
  it('100세 초과/미래연도/쓰레기 → null', () => {
    assert.equal(pickKakaoBirthYear({ birthyear: '1800' }, NOW), null)
    assert.equal(pickKakaoBirthYear({ birthyear: '2999' }, NOW), null)
    assert.equal(pickKakaoBirthYear({ birthyear: 'abcd' }, NOW), null)
  })
  it('없음/null → null', () => {
    assert.equal(pickKakaoBirthYear({}, NOW), null)
    assert.equal(pickKakaoBirthYear(null, NOW), null)
  })
})

describe('pickKakaoPhone', () => {
  it('+82 국제형식 → 국내 정규화', () => {
    assert.equal(
      pickKakaoPhone({ phone_number: '+82 10-1234-5678' }),
      '01012345678',
    )
  })
  it('국내 하이픈 형식 → 숫자만', () => {
    assert.equal(pickKakaoPhone({ phone_number: '010-1234-5678' }), '01012345678')
  })
  it('kakao_account 중첩', () => {
    assert.equal(
      pickKakaoPhone({ kakao_account: { phone_number: '+82 10-9876-5432' } }),
      '01098765432',
    )
  })
  it('빈값/비휴대폰/타입불일치 → null', () => {
    assert.equal(pickKakaoPhone({ phone_number: '' }), null)
    assert.equal(pickKakaoPhone({ phone_number: '02-123-4567' }), null)
    assert.equal(pickKakaoPhone({ phone_number: 12345 }), null)
    assert.equal(pickKakaoPhone({}), null)
    assert.equal(pickKakaoPhone(null), null)
  })
})
