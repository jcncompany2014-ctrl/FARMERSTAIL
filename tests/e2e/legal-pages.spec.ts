import { test, expect } from '@playwright/test'

/**
 * R77-P3: 법정 표기 페이지 5종 + about 진입.
 *
 * 전자상거래법 / 개인정보보호법 의무 표기. 각 페이지가 200 응답 + 시행일
 * 표시 + 핵심 키워드 노출되어야 함.
 */

const LEGAL_PAGES: Array<{ path: string; title: RegExp; keywords: string[] }> = [
  {
    path: '/legal',
    title: /약관|정책/,
    keywords: ['이용약관', '개인정보처리방침', '환불'],
  },
  {
    path: '/legal/terms',
    title: /이용약관/,
    keywords: ['시행일', '청약철회', '사료관리법'],
  },
  {
    path: '/legal/privacy',
    title: /개인정보처리방침/,
    keywords: ['시행일', '처리 목적', '보유 및 이용 기간'],
  },
  {
    path: '/legal/refund',
    title: /환불/,
    keywords: ['시행일', '7일', '냉장', '냉동'],
  },
  {
    path: '/business',
    title: /사업자/,
    keywords: ['사업자등록번호', '통신판매업', '연수구'],
  },
  {
    path: '/about',
    title: /브랜드|파머스테일/,
    keywords: ['파머스테일'],
  },
]

for (const page of LEGAL_PAGES) {
  test(`${page.path} — 200 + 키워드 확인`, async ({ page: pwPage }) => {
    const response = await pwPage.goto(page.path)
    expect(response?.status()).toBeLessThan(400)
    await expect(pwPage).toHaveTitle(page.title)
    const bodyText = await pwPage.locator('body').innerText()
    for (const keyword of page.keywords) {
      expect(bodyText).toContain(keyword)
    }
  })
}
