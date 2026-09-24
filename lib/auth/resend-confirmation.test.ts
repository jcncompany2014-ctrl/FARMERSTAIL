import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEmailNotConfirmed, resendConfirmationMessage } from './resend-confirmation.ts'

test('isEmailNotConfirmed: 인증 전 로그인만 가려낸다 — 틀린 비밀번호와 섞이면 안 된다', () => {
  // 2026-09-10 실제 로그: 400 email_not_confirmed 가 9번 "비밀번호가 올바르지 않아요"로 보였다
  assert.equal(isEmailNotConfirmed({ code: 'email_not_confirmed', message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmed({ code: undefined, message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
  assert.equal(isEmailNotConfirmed(null), false)
})

test('resendConfirmationMessage: 성공·한도 초과·기타 실패를 구분한다', () => {
  const ok = resendConfirmationMessage(null)
  assert.equal(ok.ok, true)
  assert.match(ok.text, /스팸함/)
  const rl = resendConfirmationMessage({ status: 429, code: 'over_email_send_rate_limit' })
  assert.equal(rl.ok, false)
  assert.equal(rl.rateLimited, true)
  const other = resendConfirmationMessage({ status: 500, code: 'unexpected_failure' })
  assert.equal(other.rateLimited, false)
  assert.match(other.text, /고객센터/)
})
