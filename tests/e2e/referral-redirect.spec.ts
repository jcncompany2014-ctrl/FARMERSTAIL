import { test, expect } from '@playwright/test'

/**
 * R77-P3: 친구 초대 진입점 흐름.
 *
 * /r/[code] 가:
 *   1. 형식 안 맞으면 / 로 redirect (cookie 안 set)
 *   2. 형식 맞으면 익명 사용자 → /start?ref=CODE 로 redirect
 *   3. ft_ref cookie set (httpOnly=false, 30일)
 *
 * DB write 없음 — pure redirect 라우트.
 */

test.describe('Referral redirect /r/[code]', () => {
  test('형식 잘못된 코드 → 홈으로 redirect (cookie 없음)', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/r/INVALID@!')
    // 홈으로 떨어졌어야
    expect(page.url()).toMatch(/\/$|\/\?/)
    // ft_ref cookie 없음
    const cookies = await context.cookies()
    const ref = cookies.find((c) => c.name === 'ft_ref')
    expect(ref).toBeUndefined()
  })

  test('형식 맞는 코드 → /start?ref=CODE redirect + cookie set', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/r/FT-AB12CD')
    // start(설문 자동가입) 로 redirect, ref query 포함
    expect(page.url()).toContain('/start')
    expect(page.url()).toContain('ref=FT-AB12CD')
    // ft_ref cookie set
    const cookies = await context.cookies()
    const ref = cookies.find((c) => c.name === 'ft_ref')
    expect(ref?.value).toBe('FT-AB12CD')
  })

  test('이미 ft_ref cookie 있으면 덮어쓰지 않음 (먼저 받은 초대 우선)', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await context.addCookies([
      {
        name: 'ft_ref',
        value: 'FT-FIRST1',
        url: page.url() || 'http://localhost:3000',
      },
    ])
    await page.goto('/r/FT-SECOND')
    const cookies = await context.cookies()
    const ref = cookies.find((c) => c.name === 'ft_ref')
    // 먼저 받은 FT-FIRST1 유지
    expect(ref?.value).toBe('FT-FIRST1')
  })
})
