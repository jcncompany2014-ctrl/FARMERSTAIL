import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addressInputSchema,
  rowToAddress,
  toDbPayload,
  type AddressRow,
} from './addresses.ts'

/**
 * lib/commerce/addresses.ts — 배송지 스키마 + 변환 헬퍼.
 *
 * 회귀 가드:
 *  - phone regex: 한국 휴대폰 + 일반전화 + 국제번호 일부 허용 (너무 빡빡히 X)
 *  - zip regex: 정확히 5자리 숫자
 *  - 빈 문자열 → null 변환 (label, address_detail)
 *  - camelCase ↔ snake_case 일관성
 */

function validRowFixture(): AddressRow {
  return {
    id: 'addr-1',
    user_id: 'user-1',
    label: '집',
    recipient_name: '홍길동',
    phone: '010-1234-5678',
    zip: '06234',
    address: '서울시 강남구 테헤란로 123',
    address_detail: '4층 401호',
    is_default: true,
    created_at: '2026-05-15T00:00:00Z',
    updated_at: '2026-05-15T00:00:00Z',
  }
}

describe('rowToAddress', () => {
  it('snake_case row → camelCase Address', () => {
    const row = validRowFixture()
    const addr = rowToAddress(row)
    assert.equal(addr.id, 'addr-1')
    assert.equal(addr.label, '집')
    assert.equal(addr.recipientName, '홍길동')
    assert.equal(addr.phone, '010-1234-5678')
    assert.equal(addr.zip, '06234')
    assert.equal(addr.address, '서울시 강남구 테헤란로 123')
    assert.equal(addr.addressDetail, '4층 401호')
    assert.equal(addr.isDefault, true)
  })

  it('label / address_detail null → 빈 문자열', () => {
    const row = { ...validRowFixture(), label: null, address_detail: null }
    const addr = rowToAddress(row)
    assert.equal(addr.label, '')
    assert.equal(addr.addressDetail, '')
  })
})

describe('addressInputSchema — 필수 필드', () => {
  it('정상 입력 통과', () => {
    const r = addressInputSchema.safeParse({
      recipientName: '홍길동',
      phone: '010-1234-5678',
      zip: '06234',
      address: '서울시 강남구',
    })
    assert.equal(r.success, true)
  })

  it('recipientName 누락 → fail', () => {
    const r = addressInputSchema.safeParse({
      phone: '010-1234-5678',
      zip: '06234',
      address: '서울시 강남구',
    })
    assert.equal(r.success, false)
  })

  it('빈 recipientName → fail (한국어 메시지)', () => {
    const r = addressInputSchema.safeParse({
      recipientName: '   ',
      phone: '010-1234-5678',
      zip: '06234',
      address: '서울시 강남구',
    })
    assert.equal(r.success, false)
    if (!r.success) {
      const msg = r.error.issues[0]?.message ?? ''
      assert.match(msg, /이름/)
    }
  })
})

describe('addressInputSchema — phone regex', () => {
  it('한국 휴대폰 (대시) OK', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, true)
  })

  it('한국 휴대폰 (대시 없음) OK', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '01012345678',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, true)
  })

  it('일반전화 (지역) OK', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '02-555-1234',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, true)
  })

  it('국제번호 (+82) OK — 너무 빡빡히 막지 않음', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '+82 10 1234 5678',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, true)
  })

  it('한국어/영문 들어간 phone → fail', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-오공칠',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, false)
  })

  it('너무 짧은 phone → fail', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '12',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, false)
  })
})

describe('addressInputSchema — zip regex', () => {
  it('정확히 5자리 OK', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, true)
  })

  it('4자리 → fail (이전 우편번호 6자리 호환 X)', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '1234',
      address: 'a',
    })
    assert.equal(r.success, false)
  })

  it('6자리 → fail', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '123456',
      address: 'a',
    })
    assert.equal(r.success, false)
  })

  it('숫자 외 문자 → fail', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '0623A',
      address: 'a',
    })
    assert.equal(r.success, false)
  })
})

describe('addressInputSchema — optional 기본값', () => {
  it('label 누락 → default ""', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
    })
    if (r.success) {
      assert.equal(r.data.label, '')
      assert.equal(r.data.addressDetail, '')
      assert.equal(r.data.isDefault, false)
    }
  })

  it('label 너무 길면 → fail', () => {
    const r = addressInputSchema.safeParse({
      label: 'a'.repeat(21),
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
    })
    assert.equal(r.success, false)
  })

  it('address 너무 길면 → fail (200자 cap)', () => {
    const r = addressInputSchema.safeParse({
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: '서'.repeat(201),
    })
    assert.equal(r.success, false)
  })
})

describe('toDbPayload', () => {
  it('camelCase → snake_case 변환', () => {
    const payload = toDbPayload({
      label: '집',
      recipientName: '홍길동',
      phone: '010-1234-5678',
      zip: '06234',
      address: '서울시',
      addressDetail: '101호',
      isDefault: true,
    })
    assert.equal(payload.recipient_name, '홍길동')
    assert.equal(payload.address_detail, '101호')
    assert.equal(payload.is_default, true)
    assert.equal(payload.label, '집')
  })

  it('빈 label → null (DB column nullable)', () => {
    const payload = toDbPayload({
      label: '',
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
      addressDetail: '',
      isDefault: false,
    })
    assert.equal(payload.label, null)
    assert.equal(payload.address_detail, null)
  })

  it('userId 전달 시 payload 에 user_id 포함', () => {
    const payload = toDbPayload(
      {
        label: '',
        recipientName: 'a',
        phone: '010-1234-5678',
        zip: '06234',
        address: 'a',
        addressDetail: '',
        isDefault: false,
      },
      'user-uuid',
    )
    assert.equal(payload.user_id, 'user-uuid')
  })

  it('userId 미전달 시 user_id 키 없음 (update 시 row 보존)', () => {
    const payload = toDbPayload({
      label: '',
      recipientName: 'a',
      phone: '010-1234-5678',
      zip: '06234',
      address: 'a',
      addressDetail: '',
      isDefault: false,
    })
    assert.equal('user_id' in payload, false)
  })

  it('앞뒤 공백 trim — DB 일관성', () => {
    const payload = toDbPayload({
      label: '  집  ',
      recipientName: '  홍길동  ',
      phone: '  010-1234-5678  ',
      zip: '  06234  ',
      address: '  서울시  ',
      addressDetail: '  101호  ',
      isDefault: false,
    })
    assert.equal(payload.recipient_name, '홍길동')
    assert.equal(payload.address, '서울시')
    assert.equal(payload.label, '집')
  })
})
