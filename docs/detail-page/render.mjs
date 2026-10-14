// 상세페이지(index.html) → 오픈마켓에 올릴 이미지.
//   node docs/detail-page/render.mjs
// 정지 섹션  → out/NN-이름.jpg (2배, 1720px — 폰에서 줄여 봐도 글자가 또렷하게)
// 움직이는 섹션(data-gif) → out/NN-이름.gif (860px, 원본 GIF 의 프레임을 그 자리에 합친다 — compose-gif.py)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
mkdirSync(out, { recursive: true })
const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
const browser = await chromium.launch(launch)

async function open(scale) {
  const page = await browser.newPage({ viewport: { width: 860, height: 1200 }, deviceScaleFactor: scale })
  await page.goto(pathToFileURL(join(here, 'index.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return page
}

const hi = await open(2)
const ids = await hi.$$eval('section[id]', (els) => els.map((e) => [e.id, e.hasAttribute('data-gif')]))
const gifs = []
for (const [i, [id, isGif]] of ids.entries()) {
  const base = `${String(i + 1).padStart(2, '0')}-${id.replace(/^s\d+[a-z]?-/, '')}`
  if (!isGif) {
    await hi.locator(`#${id}`).screenshot({ path: join(out, `${base}.jpg`), type: 'jpeg', quality: 90 })
  } else gifs.push([id, base])
}

// 움직이는 섹션 — 사진 자리를 비워 찍고, 그 자리 좌표를 넘긴다
const lo = await open(1)
await lo.addStyleTag({ content: '[data-frames]{background:transparent!important}' })
const jobs = []
for (const [id, base] of gifs) {
  const sec = lo.locator(`#${id}`)
  const png = join(out, `${base}.base.png`)
  await sec.screenshot({ path: png })
  const slots = await lo.$eval(`#${id}`, (s) => {
    const r0 = s.getBoundingClientRect()
    return [...s.querySelectorAll('[data-frames]')].map((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      return {
        src: el.dataset.frames, crop: el.dataset.crop.split(',').map(Number), circle: el.dataset.shape === 'circle',
        x: Math.round(r.left - r0.left + parseFloat(cs.borderLeftWidth)), y: Math.round(r.top - r0.top + parseFloat(cs.borderTopWidth)),
        w: Math.round(el.clientWidth), h: Math.round(el.clientHeight), radius: parseFloat(cs.borderTopLeftRadius) || 0,
      }
    })
  })
  jobs.push({ base: png, out: join(out, `${base}.gif`), slots })
}
await browser.close()
const jobFile = join(out, 'gif-jobs.json')
writeFileSync(jobFile, JSON.stringify(jobs))
execFileSync('python3', ['-I', join(here, 'compose-gif.py'), jobFile], { stdio: 'inherit' })
console.log(`${ids.length} sections → ${out}`)
