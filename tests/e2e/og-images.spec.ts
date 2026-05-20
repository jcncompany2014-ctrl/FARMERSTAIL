import { test, expect } from '@playwright/test'

/**
 * Round G1 (2026-05-20): /api/og/sku/[code] 동적 OG 이미지 응답 검증.
 */

test.describe('OG sku image (/api/og/sku/[code])', () => {
  test('FT-C01 OG 이미지 200 + content-type image', async ({ request }) => {
    const res = await request.get('/api/og/sku/C01')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toMatch(/image/)
  })

  test('잘못된 SKU 코드 — 200 (fallback default 카드)', async ({ request }) => {
    const res = await request.get('/api/og/sku/INVALID_XYZ')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toMatch(/image/)
  })

  test('Cache-Control s-maxage 헤더 설정', async ({ request }) => {
    const res = await request.get('/api/og/sku/D02')
    const cc = res.headers()['cache-control'] ?? ''
    expect(cc).toContain('s-maxage')
  })
})
