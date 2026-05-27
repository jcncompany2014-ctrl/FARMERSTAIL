import { test, expect } from '@playwright/test'

/**
 * R77-P3: SEO 인프라 (robots.txt + sitemap.xml).
 *
 * 검증:
 *   - /robots.txt 응답 + 핵심 disallow (/admin, /api, /r/) 포함
 *   - /sitemap.xml 응답 + 신규 페이지 (/contact, /faq, /about) 포함
 *
 * 출시 후 Google Search Console 가 의존하므로 fail 하면 검색 인덱싱 깨짐.
 */

test.describe('SEO infrastructure', () => {
  test('/robots.txt — disallow 핵심 경로 포함', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('User-Agent: *')
    expect(text).toMatch(/Disallow:\s*\/admin/)
    expect(text).toMatch(/Disallow:\s*\/api/)
    expect(text).toMatch(/Disallow:\s*\/r\//)
    expect(text).toMatch(/Disallow:\s*\/mypage/)
    expect(text).toMatch(/Sitemap:/)
  })

  test('/sitemap.xml — 신규 페이지 포함', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const text = await response.text()
    // 신규 페이지들
    expect(text).toContain('/contact')
    expect(text).toContain('/faq')
    expect(text).toContain('/about')
    expect(text).toContain('/legal/terms')
    expect(text).toContain('/legal/privacy')
    expect(text).toContain('/business')
    // XML 형식
    expect(text).toMatch(/<\?xml/)
    expect(text).toMatch(/<urlset/)
  })

  test('/sitemap.xml — admin / login / mypage 제외 확인', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    const text = await response.text()
    // 인증 영역은 sitemap 에 들어가면 안 됨 (robots disallow 와 모순)
    expect(text).not.toMatch(/<loc>[^<]*\/admin[^<]*<\/loc>/)
    expect(text).not.toMatch(/<loc>[^<]*\/login[^<]*<\/loc>/)
    expect(text).not.toMatch(/<loc>[^<]*\/mypage[^<]*<\/loc>/)
    expect(text).not.toMatch(/<loc>[^<]*\/r\//)
  })
})
