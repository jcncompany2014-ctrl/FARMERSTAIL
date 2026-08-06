import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { business, ftcLookupUrl } from './business.ts'

/**
 * lib/business.ts — 사업자 정보 SSOT (전자상거래법 §10).
 *
 * 회귀 가드:
 *  - 필수 필드 (companyName/ceo/businessNumber/email/phone 등) 모두 비어 있지 않음
 *  - businessNumber 형식 (10자리, 하이픈 포함)
 *  - email 형식 검증
 *  - ftcLookupUrl: 통신판매업 신고 전 / 후 모두 정상 동작
 */

describe('business object — 필수 필드 (전자상거래법 §10)', () => {
  it('상호 (companyName) 비어 있지 않음', () => {
    assert.ok(business.companyName.length > 0)
  })

  it('브랜드명 (brandName) 비어 있지 않음', () => {
    assert.ok(business.brandName.length > 0)
  })

  it('대표자 (ceo) 비어 있지 않음', () => {
    assert.ok(business.ceo.length > 0)
  })

  it('사업자등록번호 형식 — 10자리 + 하이픈 (XXX-XX-XXXXX)', () => {
    assert.match(business.businessNumber, /^\d{3}-\d{2}-\d{5}$/)
  })

  it('사업장 주소 비어 있지 않음', () => {
    assert.ok(business.address.length > 0)
  })

  it('고객센터 전화 — 한국 번호 형식', () => {
    // 070, 02, 010, 1577 등 다양 — 숫자 + 하이픈만
    assert.match(business.phone, /^[\d-]{8,15}$/)
  })

  it('이메일 — 기본 형식', () => {
    assert.match(business.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })

  it('개인정보보호 책임자 + 이메일', () => {
    assert.ok(business.privacyOfficer.length > 0)
    assert.match(business.privacyOfficerEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })

  it('호스팅 서비스 제공자 명시 (전자상거래법 §10)', () => {
    assert.ok(business.hostingProvider.length > 0)
  })
})

describe('ftcLookupUrl', () => {
  /**
   * ★조건부 단언은 조건이 거짓이 되는 순간 **조용히 아무것도 안 한다**
   * (2026-08-08 테스트 감사). 예전 이 테스트는
   *   `if (business.mailOrderNumber === '(등록 예정)') { assert… }`
   * 였는데, 신고번호가 실제로 등록되면서(제2026-인천연수구-1436호) 조건이
   * 거짓이 됐고 **단언이 한 줄도 실행되지 않게 됐다** — 그래도 초록이었다.
   *
   * 두 갈래를 **둘 다** 검증하도록 바꾼다. 값에 의존하지 않는다.
   */
  it('신고번호가 있으면 FTC 조회 링크, 없으면 "#"', () => {
    const registered = business.mailOrderNumber !== '(등록 예정)'
    if (registered) {
      // 현재 상태 — 실제 링크가 나와야 한다.
      assert.notEqual(ftcLookupUrl(), '#')
      assert.match(ftcLookupUrl(), /^https:\/\/www\.ftc\.go\.kr\//)
    } else {
      assert.equal(ftcLookupUrl(), '#')
    }
    // ★어느 쪽이든 이 단언은 항상 돈다 — 링크는 FTC 아니면 '#' 뿐이다.
    const url = ftcLookupUrl()
    assert.ok(
      url === '#' || url.startsWith('https://www.ftc.go.kr/'),
      `예상 밖 링크: ${url}`,
    )
  })

  it('FTC 도메인 또는 # 만 반환 (다른 도메인 누설 X)', () => {
    const url = ftcLookupUrl()
    assert.ok(url === '#' || url.startsWith('https://www.ftc.go.kr/'))
  })

  it('mailOrderNumber 등록 시 사업자번호가 URL 에 포함 (encodeURIComponent)', () => {
    // 직접 mailOrderNumber 변경 못 함 (const). 그러나 함수 자체 검증.
    // 현재는 '#' 가 정답 — 등록 후 동작은 회귀 가드용 placeholder.
    const url = ftcLookupUrl()
    if (url !== '#') {
      const bizNum = business.businessNumber.replace(/-/g, '')
      assert.ok(url.includes(bizNum))
    }
  })
})
