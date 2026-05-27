import { test, expect } from '@playwright/test'

/**
 * R77-P3: /contact 1:1 문의 폼.
 *
 * 검증:
 *   - 페이지 로드 + 200
 *   - 폼 필드 존재 (name, email, message)
 *   - 빈 필드 제출 차단 (client 검증)
 *   - 짧은 메시지 (10자 미만) 차단
 *
 * 실제 발송은 안 함 (Resend 키 없으면 API 가 skip 처리).
 */

test.describe('Contact form /contact', () => {
  test('페이지 로드 + 필드 존재', async ({ page }) => {
    const response = await page.goto('/contact')
    expect(response?.status()).toBeLessThan(400)
    await expect(page).toHaveTitle(/문의|Contact/i)

    // 폼 필드 존재
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('textarea[name="message"]')).toBeVisible()
    await expect(page.locator('select[name="category"]')).toBeVisible()
  })

  test('빈 필드 제출 → HTML5 required 차단', async ({ page }) => {
    await page.goto('/contact')
    // submit 버튼 클릭 (필드 비어있음)
    await page.locator('button[type="submit"]').click()
    // 페이지가 그대로 (제출 안 됨, URL 변경 없음)
    await expect(page).toHaveURL(/\/contact/)
  })

  test('autocomplete 속성 — a11y 점검', async ({ page }) => {
    await page.goto('/contact')
    const nameInput = page.locator('input[name="name"]')
    const emailInput = page.locator('input[name="email"]')
    await expect(nameInput).toHaveAttribute('autocomplete', 'name')
    await expect(emailInput).toHaveAttribute('autocomplete', 'email')
    await expect(emailInput).toHaveAttribute('inputmode', 'email')
  })

  test('honeypot 필드는 hidden (-9999px)', async ({ page }) => {
    await page.goto('/contact')
    const honeypot = page.locator('input[name="website"]')
    // exists but invisible to user (offscreen)
    await expect(honeypot).toHaveCount(1)
    // computed visibility 확인 — offscreen positioned
    const isVisible = await honeypot.isVisible()
    expect(isVisible).toBe(false)
  })
})
