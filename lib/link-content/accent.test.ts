import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ACCENT_THEMES, inferAccent, isAccentSetting, resolveAccent } from './accent.ts'

describe('/link 배너 포인트 컬러', () => {
  it('링크 주소로 브랜드를 추정한다', () => {
    assert.equal(inferAccent('https://www.instagram.com/p/DdqZuAnkoVs/'), 'instagram')
    assert.equal(inferAccent('https://smartstore.naver.com/farmerstail'), 'naver')
    assert.equal(inferAccent('https://www.coupang.com/vp/products/1'), 'coupang')
    assert.equal(inferAccent('https://link.coupang.com/a/xyz'), 'coupang')
    assert.equal(inferAccent('https://www.farmerstail.kr/start'), 'farmerstail')
    assert.equal(inferAccent('/start?utm_source=instagram'), 'farmerstail')
    assert.equal(inferAccent('https://example.com'), 'none')
    assert.equal(inferAccent('not a url'), 'none')
  })
  it('auto 면 추정, 아니면 저장값 우선 — 모르는 값은 추정으로 폴백', () => {
    assert.equal(resolveAccent('auto', 'https://smartstore.naver.com/x'), 'naver')
    assert.equal(resolveAccent('coupang', 'https://www.instagram.com/p/x'), 'coupang')
    assert.equal(resolveAccent('none', 'https://www.instagram.com/p/x'), 'none')
    assert.equal(resolveAccent('weird', 'https://www.instagram.com/p/x'), 'instagram')
    assert.equal(resolveAccent(null, '/start'), 'farmerstail')
  })
  it('설정값 검증 · 테마는 다섯 키 전부 존재', () => {
    assert.equal(isAccentSetting('auto'), true)
    assert.equal(isAccentSetting('tiktok'), false)
    for (const k of ['none', 'instagram', 'naver', 'coupang', 'farmerstail'] as const) {
      assert.ok(ACCENT_THEMES[k].badgeBg.length > 0)
    }
    assert.equal(ACCENT_THEMES.none.line, null)
    assert.match(ACCENT_THEMES.instagram.line ?? '', /linear-gradient/)
  })
})
