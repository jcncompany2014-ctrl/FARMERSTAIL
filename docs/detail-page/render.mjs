// 상세페이지(index.html) → 오픈마켓에 올릴 이미지.
//   node docs/detail-page/render.mjs
// out/full.jpg   — 한 장짜리 전체
// out/NN-*.jpg   — 섹션별(스마트스토어 등 이미지 높이 제한이 있는 곳에 나눠 올린다)
// 2배(1720px)로 찍는다 — 상세페이지는 폰에서 줄여 보이므로 글자 가장자리가 흐려지지 않게.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
)
const page = await browser.newPage({ viewport: { width: 860, height: 1200 }, deviceScaleFactor: 2 })
await page.goto(pathToFileURL(join(here, 'index.html')).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

await page.screenshot({ path: join(out, 'full.jpg'), fullPage: true, type: 'jpeg', quality: 88 })
const ids = await page.$$eval('section[id]', (els) => els.map((e) => e.id))
for (const [i, id] of ids.entries()) {
  const name = `${String(i + 1).padStart(2, '0')}-${id}.jpg`
  await page.locator(`#${id}`).screenshot({ path: join(out, name), type: 'jpeg', quality: 90 })
}
await browser.close()
console.log(`${ids.length} sections → ${out}`)
