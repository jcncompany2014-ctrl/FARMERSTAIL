import { test, expect } from '@playwright/test'

/**
 * audit #77: PWA 매니페스트 + SW 등록 happy path.
 */

test.describe('PWA basics', () => {
  test('manifest.json 200 + 필수 필드', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.ok()).toBeTruthy()
    const manifest = (await res.json()) as {
      name: string
      icons: Array<{ src: string; sizes: string }>
      start_url: string
    }
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test('SW 파일 200', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toContain('CACHE_NAME')
  })

  // 2026-10-11: 옛 테라코타 'FT' SVG 아이콘(audit #45)을 빼고 도장 로고 PNG 로 — maskable·아이폰 홈 화면은 불투명 PNG.
  test('PWA·아이폰 홈 화면 아이콘 200', async ({ request }) => {
    for (const path of ['/icons/maskable-192.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png']) {
      const res = await request.get(path)
      expect(res.ok()).toBeTruthy()
    }
  })
})
