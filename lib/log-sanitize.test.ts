import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeLogText } from './log-sanitize.ts'

describe('sanitizeLogText', () => {
  it('제어문자(개행/탭/CR) → 공백 (로그 인젝션 방지)', () => {
    assert.equal(sanitizeLogText('a\nb\tc\r\nd'), 'a b c  d')
  })

  it('6자리 이상 숫자 마스킹 (앞2 + * + 뒤2 = 카드/계좌 PII)', () => {
    assert.equal(
      sanitizeLogText('card 1234567890123456 end'),
      'card 12************56 end',
    )
  })

  it('5자리 이하(우편번호 등)는 안 건드림', () => {
    assert.equal(sanitizeLogText('zip 12345'), 'zip 12345')
  })

  it('숫자형/숫자 입력도 마스킹 + non-string 안전', () => {
    assert.equal(sanitizeLogText(12345678), '12****78')
    assert.equal(sanitizeLogText(null), '')
    assert.equal(sanitizeLogText(undefined), '')
  })

  it('길이 제한 + 말줄임표', () => {
    const out = sanitizeLogText('x'.repeat(400), 300)
    assert.equal(out.length, 301)
    assert.ok(out.endsWith('…'))
  })

  it('정상 메시지는 그대로(앞뒤 trim만)', () => {
    assert.equal(sanitizeLogText('  결제 취소에 실패했어요 '), '결제 취소에 실패했어요')
  })
})
