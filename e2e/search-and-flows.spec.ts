import { expect, test } from '@playwright/test'

/**
 * Search + critical-path flows.
 *
 * 시드된 상품 / 로그인 fixture 가 없어도 통과해야 하는 표면 검증만 모음:
 *   - SearchBar URL 동기화 (debounce, clear)
 *   - 검색 하이라이트 `<mark.ft-highlight>` 렌더
 *   - /checkout 비로그인 → /login 리다이렉트
 *   - /cart 비로그인 → 빈 상태 또는 로그인 유도
 *   - AppChrome 헤더 (logo · bell · cart) 존재
 *
 * 시드 / 로그인 / 결제 SDK 가 필요한 부분은 별도 spec 으로 분리해야 함 —
 * 이 spec 은 회귀 가드 (smoke 보다 깊고 비즈니스보다 얕음) 위치.
 */

test.describe('search bar — URL sync', () => {
  test('typing updates ?q= within debounce window', async ({ page }) => {
    await page.goto('/products')
    const input = page.getByPlaceholder('제품명·설명으로 검색')
    await input.fill('닭')
    // SearchBar 의 debounce 는 180ms — 400ms 안에는 URL 반영돼야.
    await expect(page).toHaveURL(/[?&]q=%EB%8B%AD/, { timeout: 1500 })
  })

  test('clear button removes ?q= but keeps category', async ({ page }) => {
    await page.goto('/products?category=화식&q=닭')
    const clear = page.getByLabel('검색어 지우기')
    await clear.click()
    await expect(page).not.toHaveURL(/[?&]q=/, { timeout: 1500 })
    await expect(page).toHaveURL(/category=%ED%99%94%EC%8B%9D/)
  })

  test('search query renders <mark> highlight in results when matches exist', async ({
    page,
  }) => {
    await page.goto('/products?q=한끼')
    // 매치하는 카드가 있으면 <mark.ft-highlight> 가 최소 1개. 없으면 empty state
    // 가 보임 — 이 경우엔 highlight 검증 자체를 skip.
    const empty = await page.getByText('No match · 검색 결과 없음').isVisible()
    test.skip(empty, '시드 데이터에 "한끼" 매치 없음 — skip')
    const marks = page.locator('mark.ft-highlight')
    await expect(marks.first()).toBeVisible()
  })
})

test.describe('checkout auth gate', () => {
  test('redirects unauth visitor to /login with next param', async ({ page }) => {
    const response = await page.goto('/checkout')
    // 서버 redirect → 최종 URL 이 /login 이거나 (?next=/checkout) 포함.
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe('cart page — graceful empty for visitors', () => {
  test('does not crash for unauth visitor', async ({ page }) => {
    const response = await page.goto('/cart')
    // 로그인 페이지로 리다이렉트되거나 빈 상태가 보여야 함. 5xx 는 NO.
    expect(response?.status()).toBeLessThan(500)
    const ok =
      page.url().includes('/login') ||
      (await page.getByText(/비어 있음|장바구니|로그인/).first().isVisible({
        timeout: 3000,
      }).catch(() => false))
    expect(ok).toBeTruthy()
  })
})

test.describe('app chrome — logged-in surface', () => {
  // AppChrome 은 (main) 라우트 그룹에 들어 있어 비로그인도 일부 페이지에서
  // 보일 수 있다. /products 는 PublicPageShell 이라 chrome 미적용.
  // /dashboard 는 chrome 적용 + 로그인 필수 → 비로그인 fixture 만으로 검증
  // 가능한 건 "redirect 동작" 까지. chrome 자체 검증은 별도 (auth fixture).
  test('/dashboard redirects unauth users', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})

test.describe('blog & products — both render without auth', () => {
  test('/blog loads', async ({ page }) => {
    const res = await page.goto('/blog')
    expect(res?.ok()).toBeTruthy()
    await expect(page.locator('body')).toContainText(/매거진|Magazine|Chapters/)
  })

  test('/products loads with kicker + h1', async ({ page }) => {
    const res = await page.goto('/products')
    expect(res?.ok()).toBeTruthy()
    // 카탈로그 라벨 — kicker 로 보일 것.
    await expect(page.locator('body')).toContainText(/제품|Catalog|농장에서/)
  })
})
