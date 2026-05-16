import { test, expect } from '@playwright/test'

/**
 * audit #77: 인증 게이트 — 미로그인 시 보호된 라우트 차단.
 */

test.describe('Auth gate', () => {
  test('/dashboard 미로그인 진입 → /app-required 또는 /login', async ({ page }) => {
    const response = await page.goto('/dashboard')
    // 진입 시 redirect — 최종 URL 이 /login 또는 /app-required 여야.
    const final = page.url()
    expect(final).toMatch(/(login|app-required)/)
    expect(response?.status()).toBeLessThan(500)
  })

  test('/mypage 미로그인 → /mypage/orders 또는 /login (web 호환)', async ({
    page,
  }) => {
    await page.goto('/mypage')
    const final = page.url()
    // proxy.ts 가 /mypage 를 /mypage/orders 로 redirect 하거나 /login.
    expect(final).toMatch(/(mypage\/orders|login|app-required)/)
  })
})
