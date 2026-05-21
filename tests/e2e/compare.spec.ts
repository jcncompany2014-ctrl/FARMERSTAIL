import { test, expect } from '@playwright/test'

/**
 * Round G1 (2026-05-20): /compare 5종 SKU 비교 페이지 happy path.
 */

test.describe('Compare page (/compare)', () => {
  test('5종 SKU 비교 페이지 진입 + 영양 매트릭스 표 노출', async ({ page }) => {
    const response = await page.goto('/compare')
    expect(response?.status()).toBeLessThan(400)

    // 페이지 제목
    await expect(page).toHaveTitle(/5종 비교/)
    // 핵심 SKU 라벨 5종 모두 표시 (server 측 표)
    await expect(page.locator('text=FT-C01')).toBeVisible()
    await expect(page.locator('text=FT-D02')).toBeVisible()
    await expect(page.locator('text=FT-S03')).toBeVisible()
    await expect(page.locator('text=FT-P04')).toBeVisible()
    await expect(page.locator('text=FT-B05')).toBeVisible()
  })

  test('페르소나 selector 노출', async ({ page }) => {
    await page.goto('/compare')
    // CSR 로딩 — radar 차트가 렌더되기 위해 잠시 대기
    await expect(page.locator('text=페르소나로 좁히기')).toBeVisible({
      timeout: 5000,
    })
    // 5개 페르소나 chip 노출
    await expect(page.getByRole('button', { name: '입문' })).toBeVisible()
    await expect(page.getByRole('button', { name: '노령' })).toBeVisible()
    await expect(page.getByRole('button', { name: '알레르기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '활동多' })).toBeVisible()
    await expect(page.getByRole('button', { name: '소화민감' })).toBeVisible()
  })

  test('FEDIAF 권장 행 노출 (객관 기준)', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.locator('text=FEDIAF 권장')).toBeVisible()
  })
})
