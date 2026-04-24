import { expect, test } from '@playwright/test'

/**
 * 로그인/회원가입 폼 validation E2E. 실제 Supabase 인증 플로우는 비용이 커서
 * unit 에서 커버하고 여기선 클라이언트 폼 검증 (required, email 포맷, 비밀번호
 * 정책 안내) 만 확인.
 */

test.describe('login form', () => {
  test('blocks submission with empty fields', async ({ page }) => {
    await page.goto('/login')
    const email = page.getByLabel(/이메일/)
    const password = page.getByLabel(/비밀번호/)
    await expect(email).toBeVisible()
    await expect(password).toBeVisible()

    const submit = page.getByRole('button', { name: /로그인/ })
    await submit.click()

    // HTML5 required 또는 커스텀 에러 — URL 이 /login 에서 안 움직였으면 통과.
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects malformed email', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/이메일/).fill('not-an-email')
    await page.getByLabel(/비밀번호/).fill('somepassword')
    await page.getByRole('button', { name: /로그인/ }).click()
    // 네이티브 :invalid UI 든 inline 에러든 폼 위치가 유지돼야 함.
    await expect(page).toHaveURL(/\/login/)
  })

  test('signup page is reachable from login', async ({ page }) => {
    await page.goto('/login')
    const signupLink = page.getByRole('link', { name: /회원가입|가입/ })
    await expect(signupLink).toBeVisible()
    await signupLink.click()
    await expect(page).toHaveURL(/\/signup/)
  })
})

test.describe('auth pages are noindex', () => {
  test('login has robots meta noindex', async ({ page }) => {
    await page.goto('/login')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
  })

  test('signup has robots meta noindex', async ({ page }) => {
    await page.goto('/signup')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
  })
})
