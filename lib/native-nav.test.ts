import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nativeApiUrl, nativeTargetPath } from './native-nav.ts'

/**
 * `appUrlOpen` 은 기기의 아무 앱이나 인텐트로 쏠 수 있다 — 이 표가 그
 * 신뢰 경계다. 여기 통과하는 문자열만 우리 WebView 를 움직인다.
 */

test('nativeTargetPath: 서버가 보내는 상대 경로를 통과시킨다', () => {
  // lib/push/native.ts 를 통해 실제로 나가는 값들 (app/api/cron/* 실측)
  for (const p of [
    '/mypage/subscriptions',
    '/mypage/notifications',
    '/dogs/new',
    '/dogs',
    '/start',
    '/admin',
  ]) {
    assert.equal(nativeTargetPath(p), p, `${p} 는 통과해야 한다`)
  }
})

test('nativeTargetPath: 쿼리·해시를 보존한다', () => {
  assert.equal(nativeTargetPath('/orders/42?tab=shipping'), '/orders/42?tab=shipping')
  assert.equal(
    nativeTargetPath('https://www.farmerstail.kr/orders/42?tab=shipping#top'),
    '/orders/42?tab=shipping#top',
  )
})

test('nativeTargetPath: 우리 호스트의 절대 URL 은 경로로 줄인다', () => {
  assert.equal(nativeTargetPath('https://www.farmerstail.kr/dogs'), '/dogs')
  assert.equal(nativeTargetPath('https://farmerstail.kr/dogs'), '/dogs')
  // 대문자 호스트/스킴도 URL 이 정규화한다
  assert.equal(nativeTargetPath('HTTPS://WWW.FARMERSTAIL.KR/dogs'), '/dogs')
})

test('nativeTargetPath: 남의 호스트는 전부 거부', () => {
  for (const bad of [
    'https://evil.com/steal',
    // 서브도메인 위장 — 정확 일치라서 막힌다
    'https://www.farmerstail.kr.evil.com/steal',
    // userinfo 위장 — hostname 은 evil.com 이다
    'https://www.farmerstail.kr@evil.com/steal',
    // 우리 도메인의 다른 서브도메인도 허용 목록에 없으면 거부
    'https://preview.farmerstail.kr/steal',
  ]) {
    assert.equal(nativeTargetPath(bad), null, `${bad} 는 막아야 한다`)
  }
})

test('nativeTargetPath: https 아닌 스킴은 전부 거부', () => {
  for (const bad of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://scan/#Intent;scheme=zxing;end',
    'data:text/html,<script>alert(1)</script>',
    'http://www.farmerstail.kr/dogs', // 평문 http 도 거부
  ]) {
    assert.equal(nativeTargetPath(bad), null, `${bad} 는 막아야 한다`)
  }
})

test('nativeTargetPath: safeNextPath 의 경로 방어를 그대로 물려받는다', () => {
  // 프로토콜 상대 URL — 브라우저가 외부 도메인으로 읽는다
  assert.equal(nativeTargetPath('//evil.com'), null)
  // 백슬래시 변형 — 일부 브라우저가 // 처럼 해석
  assert.equal(nativeTargetPath('/\\evil.com'), null)
  // 인증 직후 GET 으로 부작용 엔드포인트를 태우는 것
  assert.equal(nativeTargetPath('/api/account/delete'), null)
  // 절대 URL 로 감싸도 같은 검사를 통과해야 한다
  assert.equal(nativeTargetPath('https://www.farmerstail.kr/api/account/delete'), null)
})

test('nativeTargetPath: 경로가 아닌 것 · 빈 값은 거부', () => {
  for (const bad of [
    null,
    undefined,
    42,
    {},
    [],
    '',
    '   ',
    'mypage/subscriptions', // 앞 슬래시 없음
    'dogs',
  ]) {
    assert.equal(nativeTargetPath(bad), null, `${JSON.stringify(bad)} 는 막아야 한다`)
  }
})

test('nativeTargetPath: 앞뒤 공백은 다듬는다', () => {
  assert.equal(nativeTargetPath('  /dogs  '), '/dogs')
})

/**
 * `nativeApiUrl` — 안드로이드 intent-filter 가 경로 구분 없이 앱을 열어서,
 * 메일의 /api 링크(뉴스레터 확인·수신거부)가 앱 안에서 조용히 죽던 것의 수선.
 * nativeTargetPath 가 null 을 준 것 중 "우리 호스트 https /api/*" 만 살린다.
 */
test('nativeApiUrl: 우리 호스트의 /api 절대 URL 만 그대로 돌려준다', () => {
  // 메일에 실제로 박히는 두 링크 (lib/email/index.ts · templates/newsletter*.ts)
  const confirm =
    'https://www.farmerstail.kr/api/newsletter/confirm?token=0123456789abcdef0123456789abcdef'
  assert.equal(nativeApiUrl(confirm), confirm)
  const unsub =
    'https://farmerstail.kr/api/newsletter/unsubscribe?token=0123456789abcdef0123456789abcdef'
  assert.equal(nativeApiUrl(unsub), unsub)
})

test('nativeApiUrl: nativeTargetPath 와 겹치지 않는다 — 화면 경로는 null', () => {
  for (const notApi of [
    'https://www.farmerstail.kr/dogs',
    'https://www.farmerstail.kr/',
    'https://www.farmerstail.kr/apifake', // /api/ 접두사가 아니다
  ]) {
    assert.equal(nativeApiUrl(notApi), null, `${notApi} 는 화면 라우팅 몫이다`)
  }
})

test('nativeApiUrl: 남의 호스트·비 https·상대 경로는 전부 거부', () => {
  for (const bad of [
    'https://evil.com/api/newsletter/confirm?token=x',
    'https://www.farmerstail.kr.evil.com/api/x',
    'https://www.farmerstail.kr@evil.com/api/x',
    'http://www.farmerstail.kr/api/newsletter/confirm', // 평문
    'javascript:alert(1)',
    // 상대 /api 는 받지 않는다 — 푸시 data.url 에서 /api 가 오는 건 버그다
    '/api/newsletter/confirm?token=x',
    null,
    '',
  ]) {
    assert.equal(nativeApiUrl(bad), null, `${JSON.stringify(bad)} 는 막아야 한다`)
  }
})
