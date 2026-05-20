import { test, expect } from '@playwright/test'

/**
 * Round G1 (2026-05-20): /tools/* 도구 페이지 happy paths.
 */

test.describe('Raw Ca:P calculator (/tools/raw-calculator)', () => {
  test('계산기 페이지 진입 + 기본 식재료 행 렌더', async ({ page }) => {
    const response = await page.goto('/tools/raw-calculator')
    expect(response?.status()).toBeLessThan(400)

    await expect(page).toHaveTitle(/Raw Ca:P 계산기/)
    await expect(page.locator('text=RAW Ca:P 계산기')).toBeVisible()
    // 기본 entry — 닭가슴살
    await expect(page.locator('option:has-text("닭가슴살")')).toBeAttached()
    // Krook 인용 안내
    await expect(page.locator('text=Krook')).toBeVisible()
  })

  test('자견 모드 토글 표시', async ({ page }) => {
    await page.goto('/tools/raw-calculator')
    await expect(page.locator('text=자견 (12개월 미만)')).toBeVisible()
  })
})

test.describe('Elimination Diet (/tools/elimination-diet)', () => {
  test('8주 가이드 페이지 진입 + 시작 버튼', async ({ page }) => {
    const response = await page.goto('/tools/elimination-diet')
    expect(response?.status()).toBeLessThan(400)

    await expect(page).toHaveTitle(/Elimination Diet/)
    await expect(page.locator('text=ELIMINATION DIET 8주')).toBeVisible()
    // 시작 버튼 (LocalStorage 미시작 상태)
    await expect(page.getByRole('button', { name: /오늘부터 시작/ })).toBeVisible()
  })

  test('Jackson 2024 인용 footer', async ({ page }) => {
    await page.goto('/tools/elimination-diet')
    await expect(page.locator('text=Jackson HA')).toBeVisible()
  })
})
