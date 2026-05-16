import { test, expect } from '@playwright/test'

/**
 * audit #77: 마케팅 랜딩 진입 happy path.
 */

test.describe('Landing page', () => {
  test('루트 / 진입 시 200 + 핵심 텍스트 노출', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(400)

    // 브랜드 이름 노출 (정확한 텍스트는 마케팅 카피 변경 시 영향 받음 — kicker 로 우회).
    await expect(page).toHaveTitle(/파머스테일|Farmer.+Tail/i)
  })

  test('viewport zoom 허용 (audit #41)', async ({ page }) => {
    await page.goto('/')
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewportMeta).toBeTruthy()
    expect(viewportMeta).not.toContain('user-scalable=no')
    expect(viewportMeta).not.toContain('maximum-scale=1')
  })
})
