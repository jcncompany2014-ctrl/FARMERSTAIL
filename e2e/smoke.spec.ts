import { expect, test } from '@playwright/test'

/**
 * Smoke tests — must never fail on main. 랜딩페이지 로드, 주요 링크 도달,
 * 200 응답, 메타태그 존재 여부만 확인. 비즈니스 로직 assertion 은 다른
 * spec 으로 분리.
 */

test.describe('home', () => {
  test('loads with brand title + hero', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.ok()).toBeTruthy()

    await expect(page).toHaveTitle(/파머스테일/)
    // Hero CTA — 랜딩에 항상 존재. 위치/문구는 바뀌어도 브랜드 문구는 유지.
    await expect(page.getByRole('link', { name: /제품|시작|플랜/ }).first()).toBeVisible()
  })

  test('exposes canonical + og:image meta', async ({ page }) => {
    await page.goto('/')
    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveCount(1)
    const og = page.locator('meta[property="og:image"]').first()
    await expect(og).toHaveAttribute('content', /.+/)
  })

  test('injects Organization JSON-LD', async ({ page }) => {
    await page.goto('/')
    const script = page.locator('script#ld-organization')
    await expect(script).toHaveCount(1)
    const content = await script.textContent()
    expect(content).toBeTruthy()
    const parsed = JSON.parse(content ?? '{}')
    expect(parsed['@type']).toBe('Organization')
  })
})

test.describe('legal + discoverability', () => {
  test('robots.txt lists sitemap + disallows admin', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.ok()).toBeTruthy()
    const body = await res.text()
    expect(body).toMatch(/Sitemap:\s*https?:/)
    expect(body).toMatch(/Disallow:\s*\/admin/)
  })

  test('sitemap.xml returns XML with at least one url', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.ok()).toBeTruthy()
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('xml')
    const body = await res.text()
    expect(body).toMatch(/<urlset[\s\S]*<url>[\s\S]*<loc>/)
  })
})

test.describe('404 handling', () => {
  test('unknown route renders not-found', async ({ page }) => {
    const response = await page.goto('/this-route-definitely-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.locator('body')).toContainText(/찾을 수 없|404|페이지/)
  })
})
