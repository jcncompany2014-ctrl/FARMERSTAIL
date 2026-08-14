import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath } from './safe-next.ts'

/**
 * 오픈 리다이렉트 회귀 가드 (2026-08-12 4라운드 감사).
 *
 * 같은 검사가 세 곳에 흩어져 실제로 갈라져 있었다 — login 페이지엔 백슬래시
 * 변형 검사가 빠져 있었고, /start/claim 은 목적지를 아예 안 받았다.
 */

describe('safeNextPath — 돌아갈 경로 검증', () => {
  it('정상 내부 경로는 통과한다 (보호 경로 40여 곳이 이걸로 돌아온다)', () => {
    for (const p of [
      '/mypage/subscriptions',
      '/account/subscribe/abc-123',
      '/dogs/1/approve',
      '/start/survey?step=2',
    ]) {
      assert.equal(safeNextPath(p), p, p)
    }
  })

  it('★프로토콜 상대 URL 차단 — 브라우저가 외부 도메인으로 읽는다', () => {
    assert.equal(safeNextPath('//evil.com'), null)
    assert.equal(safeNextPath('//evil.com/path'), null)
  })

  it('★백슬래시 변형 차단 — login 페이지에 빠져 있던 검사', () => {
    assert.equal(safeNextPath('/\\evil.com'), null)
  })

  it('★/api 차단 — 인증 직후 GET 으로 부작용 엔드포인트를 태우는 것(R101-B)', () => {
    assert.equal(safeNextPath('/api/account/delete'), null)
    assert.equal(safeNextPath('/api/payments/webhook'), null)
  })

  it('절대 URL·스킴은 전부 거부', () => {
    for (const p of [
      'https://evil.com',
      'http://evil.com',
      'javascript:alert(1)',
      'evil.com',
      '',
    ]) {
      assert.equal(safeNextPath(p), null, p)
    }
  })

  it('없는 값은 null (기본 목적지로 폴백)', () => {
    assert.equal(safeNextPath(null), null)
    assert.equal(safeNextPath(undefined), null)
  })
})
