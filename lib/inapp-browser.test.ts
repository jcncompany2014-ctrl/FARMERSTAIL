import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chromeIntentUrl, detectInAppBrowser, isAndroidUa } from './inapp-browser.ts'

const IG_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.22.93'
const IG_AOS =
  'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.22.93 Android'
const CHROME_AOS = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36'
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'

describe('인앱 브라우저 감지', () => {
  it('인스타(iOS·AOS)·페북·카톡을 잡는다', () => {
    assert.equal(detectInAppBrowser(IG_IOS), 'instagram')
    assert.equal(detectInAppBrowser(IG_AOS), 'instagram')
    assert.equal(detectInAppBrowser('... FBAN/FBIOS ...'), 'facebook')
    assert.equal(detectInAppBrowser('... KAKAOTALK 10.4.5 ...'), 'kakaotalk')
  })
  it('일반 크롬·사파리는 null — 오탐 금지', () => {
    assert.equal(detectInAppBrowser(CHROME_AOS), null)
    assert.equal(detectInAppBrowser(SAFARI_IOS), null)
    assert.equal(detectInAppBrowser(null), null)
  })
  it('안드로이드 판정', () => {
    assert.equal(isAndroidUa(IG_AOS), true)
    assert.equal(isAndroidUa(IG_IOS), false)
  })
  it('크롬 intent URL — https 만, 경로·쿼리 보존', () => {
    assert.equal(
      chromeIntentUrl('https://www.farmerstail.kr/start?p=trial'),
      'intent://www.farmerstail.kr/start?p=trial#Intent;scheme=https;package=com.android.chrome;end',
    )
    assert.equal(chromeIntentUrl('javascript:alert(1)'), null)
    assert.equal(chromeIntentUrl('not a url'), null)
  })
})
