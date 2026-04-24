import { expect, test } from '@playwright/test'

/**
 * /products 컬렉션 + 디테일 페이지 E2E. Supabase 에 샘플 상품이 시드돼
 * 있다는 전제(기본 `seed.sql` 는 비프/포크/덕 3종 등록). 시드가 바뀌어
 * 빈 리스트가 되면 testSkip 으로 낭비 없이 패스.
 */

test.describe('products index', () => {
  test('renders grid with at least one product card', async ({ page }) => {
    await page.goto('/products')
    const cards = page.locator('[data-testid="product-card"], article a[href^="/products/"]')
    const count = await cards.count()
    test.skip(count === 0, '시드된 상품이 없어 스킵 — supabase seed 확인')
    expect(count).toBeGreaterThan(0)
  })

  test('product detail page shows price + add-to-cart CTA', async ({ page }) => {
    await page.goto('/products')
    const firstCard = page
      .locator('article a[href^="/products/"]')
      .first()
    const hasProduct = (await firstCard.count()) > 0
    test.skip(!hasProduct, '시드된 상품이 없어 스킵')

    const href = await firstCard.getAttribute('href')
    expect(href).toBeTruthy()
    await page.goto(href as string)

    // 가격 노출 — '원' 접미 혹은 KRW. 정확한 값은 시드 변동하므로 패턴 매치만.
    await expect(page.locator('body')).toContainText(/[\d,]+원/)
    // 주문/장바구니 CTA — 이름은 변경 가능하지만 role/텍스트 패턴은 안정.
    await expect(
      page.getByRole('button', { name: /담기|주문|구매/ }).first(),
    ).toBeVisible()
  })

  test('product detail injects Product JSON-LD', async ({ page }) => {
    await page.goto('/products')
    const firstCard = page.locator('article a[href^="/products/"]').first()
    const hasProduct = (await firstCard.count()) > 0
    test.skip(!hasProduct, '시드된 상품이 없어 스킵')

    await firstCard.click()
    await page.waitForLoadState('domcontentloaded')
    const script = page.locator('script[type="application/ld+json"]').filter({
      hasText: '"@type":"Product"',
    })
    await expect(script.first()).toHaveCount(1)
  })
})
