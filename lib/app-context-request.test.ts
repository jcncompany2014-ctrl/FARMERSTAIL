import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAppRequest, APP_USER_AGENT_MARKER } from './app-context-request.ts'

/**
 * 이 표가 앱/웹 화면 분기의 전부다. 여기가 틀리면 앱 안에서 웹 화면이 뜨거나
 * (2026-08-22 실제로 발생), 웹 사용자가 앱 전용 화면을 본다.
 */

const NATIVE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  `Chrome/126.0.0.0 Mobile Safari/537.36 ${APP_USER_AGENT_MARKER}`

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Mobile Safari/537.36'

test('★네이티브 콜드 스타트 — 쿠키가 없어도 UA 표식으로 앱이다', () => {
  // 이것이 이 파일이 생긴 이유. 예전엔 false 라서 첫 화면이 웹으로 렌더됐다.
  assert.equal(isAppRequest({ appCookie: undefined, userAgent: NATIVE_UA }), true)
  assert.equal(isAppRequest({ appCookie: null, userAgent: NATIVE_UA }), true)
})

test('설치된 PWA — UA 표식은 없지만 쿠키로 앱이다', () => {
  assert.equal(isAppRequest({ appCookie: '1', userAgent: BROWSER_UA }), true)
})

test('일반 브라우저 — 둘 다 없으면 웹이다', () => {
  assert.equal(isAppRequest({ appCookie: undefined, userAgent: BROWSER_UA }), false)
  assert.equal(isAppRequest({}), false)
  assert.equal(isAppRequest({ appCookie: null, userAgent: null }), false)
})

test('쿠키 값이 1 이 아니면 앱이 아니다', () => {
  // 만료 처리(`ft_app=`)나 엉뚱한 값이 앱으로 통과하면 안 된다.
  for (const bad of ['', '0', 'true', 'yes', '11', ' 1']) {
    assert.equal(
      isAppRequest({ appCookie: bad, userAgent: BROWSER_UA }),
      false,
      `쿠키 "${bad}" 는 앱이 아니어야 한다`,
    )
  }
})

test('둘 다 있으면 당연히 앱 (두 번째 요청 이후의 네이티브)', () => {
  assert.equal(isAppRequest({ appCookie: '1', userAgent: NATIVE_UA }), true)
})

test('표식이 UA 어디에 있든 잡는다', () => {
  assert.equal(
    isAppRequest({ userAgent: `${APP_USER_AGENT_MARKER}/1.0 Mozilla/5.0` }),
    true,
  )
})
