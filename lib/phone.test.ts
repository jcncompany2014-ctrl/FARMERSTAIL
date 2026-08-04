/**
 * 휴대폰 번호 정본 — 2026-08-03 검수에서 발견한 실제 사고를 못 박는다.
 *
 * 사장님 계정의 배송 연락처가 `010-3887-885`(10자리) 로 저장돼 있었고
 * 결제 버튼이 막히지 않았다. 냉동 배송은 기사님이 전화를 거는 배송이라
 * 연락 안 되는 번호 = 배송 실패다.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isKoreanMobile,
  phoneDigits,
  formatKoreanMobile,
} from './phone.ts'

describe('isKoreanMobile', () => {
  it('★010 은 뒤 8자리 고정 — 7자리는 존재하지 않는 번호다', () => {
    // 실제로 저장돼 있던 값. 옛 검증식 /^01[016789]\d{7,8}$/ 은 이걸 통과시켰다.
    assert.equal(isKoreanMobile('010-3887-885'), false)
    assert.equal(isKoreanMobile('0103887885'), false)
    assert.equal(isKoreanMobile('010-3887-8850'), true)
    assert.equal(isKoreanMobile('01038878850'), true)
  })

  it('옛 식별번호(011·016~019)는 7~8자리 둘 다 실재한다', () => {
    assert.equal(isKoreanMobile('011-234-5678'), true) // 10자리
    assert.equal(isKoreanMobile('011-2345-6789'), true) // 11자리
    assert.equal(isKoreanMobile('016-234-5678'), true)
    assert.equal(isKoreanMobile('019-234-5678'), true)
  })

  it('휴대폰이 아닌 번호는 거절', () => {
    assert.equal(isKoreanMobile('02-123-4567'), false) // 지역번호
    assert.equal(isKoreanMobile('070-4066-1333'), false) // 인터넷전화
    assert.equal(isKoreanMobile('012-345-6789'), false) // 없는 식별번호
    assert.equal(isKoreanMobile(''), false)
    assert.equal(isKoreanMobile('그냥 글자'), false)
  })

  it('하이픈·공백·국제표기를 벗기고 판정한다', () => {
    assert.equal(isKoreanMobile('010 3887 8850'), true)
    assert.equal(isKoreanMobile(' 010-3887-8850 '), true)
    assert.equal(isKoreanMobile('+82 10-3887-8850'), true)
  })
})

describe('phoneDigits', () => {
  it('+82 를 0 으로 되돌린다', () => {
    assert.equal(phoneDigits('+82 10-3887-8850'), '01038878850')
  })
  it('하이픈·공백 제거', () => {
    assert.equal(phoneDigits('010-3887-8850'), '01038878850')
  })
})

describe('formatKoreanMobile', () => {
  it('11자리 → 3-4-4, 10자리 → 3-3-4', () => {
    assert.equal(formatKoreanMobile('01038878850'), '010-3887-8850')
    assert.equal(formatKoreanMobile('0112345678'), '011-234-5678')
  })
  it('형식이 아니면 원본 그대로 — 화면에서 값을 지우지 않는다', () => {
    assert.equal(formatKoreanMobile('0103887885'), '0103887885')
  })
})
