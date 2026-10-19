/**
 * 2026-10-19 구글 서치 콘솔 "farmerstail.kr 에서 제품 스니펫 구조화된 데이터 문제가 감지됨" —
 * 심각한 문제: 'offers', 'review' 또는 'aggregateRating'을(를) 지정해야 합니다.
 *
 * 원인 두 곳(운영 실측):
 *  ① 상품 화면 /store/레시피 — 자사몰 결제 막음(규칙177·220) 동안 offers 만 빼고 Product 를 남겼다 → 가격·후기·평점 없는 상품.
 *  ② 매거진 글 Article.mentions — 글이 다루는 레시피를 이름·주소뿐인 Product 로 넣었다.
 * 가격·후기·평점 셋 중 하나 없는 Product 는 어차피 검색 결과에 안 뜨고 오류만 남는다.
 * 고친 것: ① 못 팔 땐 Product 표시 통째로 빼고(열리면 offers 와 함께 돌아온다) ② 언급은 Thing.
 * 이 규칙은 앞으로 Product 를 새로 쓰는 곳이 생기면 빨간불을 켠다 — Product 는 offers 가 붙는 상품 화면 한 곳뿐이다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — lib/audit-rules.test.ts 와 같은 방식. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** 구조화 데이터 객체 안의 '@type' 을 전부 꺼낸다(중첩까지). */
function types(v: unknown, acc: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) types(x, acc)
  else if (v && typeof v === 'object') {
    const t = (v as Record<string, unknown>)['@type']
    if (typeof t === 'string') acc.push(t)
    for (const x of Object.values(v)) types(x, acc)
  }
  return acc
}

test('규칙304: 가격·후기·평점 없는 Product 구조화 데이터 금지 — Product 는 offers 가 붙는 상품 화면 한 곳뿐', async () => {
  // ① 저장소 전체 — '@type': 'Product' 를 쓰는 곳은 상품 화면 하나뿐이어야 한다.
  const hits: string[] = []
  for (const top of ['app', 'lib', 'components']) {
    for (const f of walk(join(ROOT, top))) {
      const src = stripComments(readFileSync(f, 'utf8'))
      if (/['"]@type['"]\s*:\s*['"](Product|IndividualProduct|ProductModel|ProductGroup)['"]/.test(src)) hits.push(relative(ROOT, f).replace(/\\/g, '/'))
    }
  }
  assert.deepEqual(hits, ['app/store/[slug]/page.tsx'], `Product 구조화 데이터를 새로 쓰는 곳이 생겼다 — 가격(offers) 없이 내보내면 서치 콘솔 심각한 문제: ${hits.join(', ')}`)

  // ② 상품 화면 — 못 팔 땐 통째로 없고, 내보낼 땐 offers 가 조건 없이 붙는다.
  const page = stripComments(read('app', 'store', '[slug]', 'page.tsx'))
  assert.match(page, /const jsonLd = paused \? null : \{\s*'@context': 'https:\/\/schema\.org',\s*'@type': 'Product',/, '못 팔 때도 Product 를 내보낸다(가격 없는 상품)')
  const product = page.slice(page.indexOf('const jsonLd = paused ? null : {'), page.indexOf('const breadcrumbLd'))
  assert.match(product, /\n {4}offers: \[item500, item1k\]\.map\(/, 'Product 에 offers 가 조건 없이 붙지 않는다')
  assert.doesNotMatch(product, /\.\.\.\(paused/, 'Product 안에서 offers 를 다시 조건부로 뺀다(가격 없는 Product 가 돌아온다)')
  assert.match(page, /\{jsonLd && <script type="application\/ld\+json"/, '못 팔 때 빈 구조화 데이터 칸을 그린다')

  // ③ 매거진 글 — 언급은 Product 가 아니다(실제로 만들어 본다).
  const { buildArticleJsonLd } = (await import(pathToFileURL(join(ROOT, 'lib', 'seo', 'jsonld.ts')).href)) as typeof import('./seo/jsonld.ts')
  const ld = buildArticleJsonLd({
    title: '강아지 닭고기 먹어도 되나요',
    slug: 'x',
    description: 'd',
    coverUrl: '/magazine/x.webp',
    publishedAt: '2026-10-19T00:00:00Z',
    mentions: [
      { name: '닭고기 화식', url: '/store/chicken' },
      { name: '오리 화식', url: '/store/duck' },
    ],
  })
  const all = types(ld)
  assert.ok(all.includes('Article') && all.filter((t) => t === 'Thing').length === 2, `언급 검산이 깨졌다(카나리아): ${all.join(',')}`)
  assert.ok(!all.some((t) => /Product/.test(t)), `매거진 글 구조화 데이터에 Product 가 있다: ${all.join(',')}`)
})
