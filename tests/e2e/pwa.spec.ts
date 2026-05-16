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

  test('PWA 아이콘 SVG 200 (audit #45)', async ({ request }) => {
    const res = await request.get('/icons/icon.svg')
    expect(res.ok()).toBeTruthy()
    const maskable = await request.get('/icons/icon-maskable.svg')
    expect(maskable.ok()).toBeTruthy()
  })
})
