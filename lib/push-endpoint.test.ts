import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedPushEndpoint } from './push-endpoint.ts'

test('isAllowedPushEndpoint: 브라우저가 실제로 주는 푸시 서비스 주소는 통과', () => {
  for (const u of [
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMDNQ',
    'https://wns2-by3p.notify.windows.com/w/?token=BQYAAA',
  ]) {
    assert.equal(isAllowedPushEndpoint(u), true, u)
  }
})

test('isAllowedPushEndpoint: 임의 호스트·내부망·http·포트·사칭 호스트는 거부 (SSRF)', () => {
  for (const u of [
    'https://evil.example.com/push',
    'https://127.0.0.1/push',
    'https://169.254.169.254/latest/meta-data',
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilnotify.windows.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'not a url',
    '',
  ]) {
    assert.equal(isAllowedPushEndpoint(u), false, u)
  }
  assert.equal(isAllowedPushEndpoint(null), false)
  assert.equal(isAllowedPushEndpoint(42), false)
})
