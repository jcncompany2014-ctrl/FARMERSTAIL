import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSupabaseSessionCookieName,
  hasSupabaseSessionCookie,
} from './session-cookie.ts'

const REF = 'adynmnrzffidoilnxutg'

test('★조각난 세션 쿠키(.0/.1)를 세션으로 인정한다 — 카카오 로그인의 실제 형태', () => {
  // 이것이 이 파일이 생긴 이유. endsWith('-auth-token') 은 이걸 놓쳐서
  // 로그인한 앱 사용자가 온보딩으로 보내졌다.
  assert.equal(isSupabaseSessionCookieName(`sb-${REF}-auth-token.0`), true)
  assert.equal(isSupabaseSessionCookieName(`sb-${REF}-auth-token.1`), true)
  assert.equal(isSupabaseSessionCookieName(`sb-${REF}-auth-token.4`), true)
})

test('통짜 세션 쿠키도 인정한다 (작은 세션은 안 쪼개진다)', () => {
  assert.equal(isSupabaseSessionCookieName(`sb-${REF}-auth-token`), true)
})

test('code-verifier(PKCE·OAuth 진행중 쿠키)는 세션이 아니다', () => {
  // 로그인을 시작만 한 사용자를 로그인으로 오판하면 /dashboard→/login 튕김.
  assert.equal(
    isSupabaseSessionCookieName(`sb-${REF}-auth-token-code-verifier`),
    false,
  )
})

test('무관한 쿠키는 전부 거부', () => {
  for (const name of [
    'ft_app',
    'sb-',
    'sb-x-auth-token-extra',
    `sb-${REF}-auth-token.x`, // 숫자 아닌 접미
    `xsb-${REF}-auth-token`, // 접두 오염
    '',
  ]) {
    assert.equal(isSupabaseSessionCookieName(name), false, `${name} 는 거부`)
  }
})

test('hasSupabaseSessionCookie — 목록 판정', () => {
  assert.equal(
    hasSupabaseSessionCookie(['ft_app', `sb-${REF}-auth-token.0`]),
    true,
  )
  assert.equal(
    hasSupabaseSessionCookie(['ft_app', `sb-${REF}-auth-token-code-verifier`]),
    false,
  )
  assert.equal(hasSupabaseSessionCookie([]), false)
})
