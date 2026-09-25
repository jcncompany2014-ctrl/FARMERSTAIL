import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickShippingTarget } from './shipping-target.ts'

const A = { name: '김기본', phone: '010-1', zip: '11111', address: '기본로 1', addressDetail: '101호' }
const P = { name: '김프로필', phone: '010-2', zip: '22222', address: '프로필로 2', addressDetail: null }
const S = { name: '김신청', phone: '010-3', zip: '33333', address: '신청로 3', addressDetail: '' }

test('기본 배송지가 있으면 그것 — 이사한 고객의 새 주소가 이긴다', () => {
  assert.equal(pickShippingTarget([A, P, S])?.address, '기본로 1')
})

test('기본 배송지가 없으면 프로필', () => {
  assert.equal(pickShippingTarget([null, P, S])?.address, '프로필로 2')
})

test('★ 둘 다 없으면 구독 신청서 주소 — 예전엔 null 이라 결제가 매일 건너뛰어졌다', () => {
  // 가입 프로필은 이름만 있고(웹·카카오·애플 가입) 신청 화면에서 저장 체크를 끈 고객
  const emptyProfile = { name: '김가입', phone: '', zip: '', address: '' }
  const t = pickShippingTarget([null, emptyProfile, S])
  assert.equal(t?.address, '신청로 3')
  assert.equal(t?.addressDetail, null, '빈 상세주소는 null 로')
})

test('필수 칸이 하나라도 비면 후보가 아니다', () => {
  assert.equal(pickShippingTarget([{ ...A, phone: '  ' }, P])?.address, '프로필로 2')
  assert.equal(pickShippingTarget([{ ...A, zip: null }])?.address, undefined)
  assert.equal(pickShippingTarget([]), null)
  assert.equal(pickShippingTarget([null, undefined]), null)
})
