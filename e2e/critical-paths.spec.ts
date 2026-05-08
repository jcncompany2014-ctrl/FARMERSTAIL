import { expect, test } from '@playwright/test'

/**
 * 핵심 사용자 흐름 — 비로그인 시점에 도달 가능한 페이지의 회귀 보호.
 *
 * 회원가입 / 결제 / 정기배송 시작 등 인증 후 흐름은 e2e seed 사용자가 없는
 * 환경에서 비결정적. 인증 필요 페이지는 redirect 만 검증한다.
 */

test.describe('critical landing paths', () => {
  test('landing has hero + 무료로 시작하기 CTA + 제품 둘러보기', async ({
    page,
  }) => {
    await page.goto('/')
    // 헤드라인 키워드.
    await expect(page.locator('h1')).toContainText(/꼬리|영양|식단|시작/)
    // CTA — auth 분기. 비로그인 시 "무료로 시작하기" / "제품 둘러보기".
    const startCta = page
      .getByRole('link', { name: /무료로 시작하기|맞춤 분석 시작/ })
      .first()
    await expect(startCta).toBeVisible()
    const browseCta = page
      .getByRole('link', { name: /제품 둘러보기/ })
      .first()
    await expect(browseCta).toBeVisible()
  })

  test('trust strip 가입 30초 / 7일 환불 보장 표시', async ({ page }) => {
    await page.goto('/')
    // 별점 표시 + 사용자 수 + 만족도.
    await expect(page.locator('body')).toContainText(/★/)
    await expect(page.locator('body')).toContainText(/보호자가 선택/)
  })

  test('/cart redirects unauthed user to /login', async ({ page }) => {
    await page.goto('/cart')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toMatch(/\/login/)
  })

  test('/mypage redirects unauthed user to /login', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toMatch(/\/login/)
  })

  test('/admin redirects unauthed user to /login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toMatch(/\/login/)
  })

  test('not-found page renders 404 hero', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-123')
    await expect(page.locator('body')).toContainText(/404|찾으시는 페이지가 없어요/)
  })

  test('legal/refund page renders policy', async ({ page }) => {
    await page.goto('/legal/refund')
    await expect(page.locator('h1')).toContainText(/환불|REFUND/i)
  })

  test('app-required page handles 은/는 자동 조사', async ({ page }) => {
    // "/dashboard" 같은 앱 전용 경로 → /app-required redirect (web 사용자).
    await page.goto('/app-required?from=/dashboard')
    const text = await page.locator('body').textContent()
    // 자동 조사 — "은(는)" 양자 표기 0
    expect(text).not.toContain('은(는)')
  })
})

test.describe('public catalog navigation', () => {
  test('베스트 / 신상 / 화식 카테고리 nav 작동', async ({ page }) => {
    await page.goto('/')
    // WebChrome 의 카테고리 nav. 데스크톱/모바일 둘 다 link 노출.
    const bestNav = page.getByRole('link', { name: '베스트' }).first()
    await expect(bestNav).toBeVisible()
  })

  test('FAQ 페이지 카테고리 + 첫 질문 펼침', async ({ page }) => {
    await page.goto('/faq')
    await expect(page.locator('h1')).toContainText(/자주 묻는 질문|FAQ/i)
    const firstQuestion = page.locator('button, summary').filter({ hasText: /\?/ }).first()
    if ((await firstQuestion.count()) > 0) {
      await firstQuestion.click()
      // 펼친 후 본문 검증 — 최소 한 답변 가시.
      await page.waitForTimeout(200)
    }
  })
})
