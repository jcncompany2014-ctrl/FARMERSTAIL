/**
 * 2026-10-17 웹 첫 화면 다시 짜기(사장님 "첫화면만 좀 다시짜볼까 … 체험팩 14900원 … 치킨 레시피 바로옆에 작은 글씨로 닭고기 화식 …
 * 색 들어가는 데마다 위에 띠가 있는데 AI 티") — 규칙 291~293. 체험팩 값은 규칙199(lib/audit-rules-1013-ops.test.ts)가 지킨다.
 *
 *   291 레시피 색 띠 없음 — 사진·카드 위(또는 머리) 가로 띠, 카드 위 색 테두리, 4색 띠, 머리말 색 막대. 작은 네모 표시는 괜찮다.
 *   292 가게 이름 = 큰 '치킨 레시피' + 바로 옆 작은 '닭고기 화식'(부품 하나) — 주문서·영수증·제공고시 이름은 그대로 '닭고기 화식'
 *   293 홈 순서 = 증거 → 레시피 → 체험팩 → 후기 → 행사 → 계산기 → 만드는 과정 → 매거진 → 질문, 정기배송 줄은 한 번,
 *       행사는 진행 중인 것만, 매거진은 공개 글만(쿠키 없는 조회), 손으로 옮긴 별점엔 본 날짜
 *
 * 고친 코드를 일부러 되돌려 빨간불을 검산했다. if 안에 단언을 넣지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — 주석 속 설명이 규칙에 걸리지 않게(lib/audit-rules.test.ts 와 같은 방식). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

function code(...parts: string[]): string {
  return stripComments(read(...parts))
}

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...tsxFiles(rel))
    else if (rel.endsWith('.tsx')) out.push(rel)
  }
  return out
}

/** style={{ … }} 한 덩이씩(안쪽에 중괄호가 한 겹 더 있어도 — 템플릿 문자열 `${}` 까지). */
function styleObjects(src: string): string[] {
  const out: string[] = []
  let i = src.indexOf('style={{')
  while (i >= 0) {
    let depth = 0
    let j = i + 'style='.length
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    out.push(src.slice(i, j + 1))
    i = src.indexOf('style={{', j)
  }
  return out
}

test('규칙291: 레시피 색 띠가 없다 — 사진·카드 위 가로 띠, 카드 위 색 테두리, 4색 띠, 머리말 색 막대(작은 네모 표시만 남긴다)', () => {
  const files = [...tsxFiles('app'), ...tsxFiles('components')]
  assert.ok(files.length > 100, '검사할 화면 파일을 못 찾았다')
  const bands: string[] = []
  for (const rel of files) {
    const src = code(...rel.split(sep))
    if (!/RECIPE_BAND|TRIAL_BAND/.test(src)) continue
    for (const s of styleObjects(src)) {
      const h = /\bheight: (\d+)\b/.exec(s)
      const thin = h !== null && Number(h[1]) <= 12
      const colored = /RECIPE_BAND\[|TRIAL_BAND/.test(s)
      // 폭이 없는 얇은 칸(가로로 꽉 차는 띠) — 작은 네모(width·height 둘 다 있음)는 괜찮다.
      if (thin && colored && !/\bwidth: /.test(s)) bands.push(`${relative(ROOT, join(ROOT, rel))}: ${s.slice(0, 120)}`)
      // 카드 위 색 테두리
      if (/borderTop: `\d+px solid \$\{RECIPE_BAND/.test(s)) bands.push(`${rel}: 카드 위 색 테두리 ${s.slice(0, 120)}`)
    }
    // 4색 띠 — 레시피 4색을 칸으로 나눠 늘어놓은 얇은 줄(예전 체험팩 카드·장바구니 썸네일)
    if (/TRIAL_BAND/.test(src)) bands.push(`${rel}: 4색 띠(TRIAL_BAND)`)
  }
  assert.deepEqual(bands, [], `레시피 색 띠가 남았다(사장님 10/17 "AI 티"):\n${bands.join('\n')}`)

  // 4색 띠의 다른 모양 — 얇은 grid 칸에 STORE_RECIPES 를 돌며 RECIPE_BAND 를 칠한다.
  for (const rel of ['app/page.tsx', 'components/store/CartView.tsx', 'components/store/TrialCard.tsx', 'app/reviews/page.tsx']) {
    const src = code(...rel.split('/'))
    assert.doesNotMatch(src, /height: \d{1,2}, display: 'grid', gridTemplateColumns: [^\n]*\n[^\n]*STORE_RECIPES\.map\(\(r\) => \(\s*<span key=\{r\} style=\{\{ background: RECIPE_BAND\[r\] \}\}/, `${rel}: 4색 띠가 남았다`)
  }

  // 상품 상세 머리말 = 작은 네모(예전 22×4 색 막대가 아니다)
  const detail = code('components', 'store', 'ProductDetail.tsx')
  const kicker = /function Kicker[\s\S]*?\n\}/.exec(detail)?.[0] ?? ''
  assert.match(kicker, /width: 10, height: 10/, '상품 상세 머리말 표시가 작은 네모가 아니다')
  assert.doesNotMatch(kicker, /width: 22, height: 4/, '상품 상세 머리말이 아직 색 막대다')
})

test('규칙292: 가게 이름은 큰 "치킨 레시피" + 바로 옆 작은 "닭고기 화식" — 주문서·영수증·제공고시 이름은 그대로', async () => {
  const c = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  assert.deepEqual(c.RECIPE_TITLE, { chicken: '치킨 레시피', duck: '오리 레시피', pork: '흑돼지 레시피', beef: '한우 레시피' })
  assert.deepEqual(c.RECIPE_PRODUCT_NAME, { chicken: '닭고기 화식', duck: '오리고기 화식', pork: '흑돼지 화식', beef: '한우 화식' })
  // 주문 품목·영수증 이름은 상품 이름 그대로(법정 표시·포장 목록과 같은 이름)
  assert.equal(c.storeItem('chicken-500g').name, '닭고기 화식 500g')
  assert.equal(c.storeItem('beef-1kg').name, '한우 화식 1kg')

  // 부품 하나가 두 이름을 같이 그린다 — 큰 이름(포스터 글꼴) 옆에 작은 상품 이름(본문 글꼴을 직접 적음: h1 안에서도)
  const part = code('components', 'store', 'RecipeName.tsx')
  assert.match(part, /RECIPE_TITLE\[recipe\][\s\S]*RECIPE_PRODUCT_NAME\[recipe\]/, 'RecipeName 이 큰 이름 → 작은 이름 순서가 아니다')
  assert.match(part, /alignItems: stack \? 'flex-start' : 'baseline'/, '두 이름의 글자 바닥선을 맞추지 않는다')
  assert.match(part, /fontFamily: "var\(--font-sans\)/, '작은 이름이 h1 안에서 포스터 글꼴로 바뀐다(store.css .fts main h1)')
  assert.match(part, /Math\.max\(13, Math\.round\(size \* 0\.55\)\)/, '작은 이름 크기가 0.55배(최소 13)가 아니다')

  // 손님이 레시피 이름을 보는 자리 — 홈·스토어 목록, 상세 제목, 다른 레시피 칸, 메뉴, 장바구니
  const uses: [string, RegExp][] = [
    ['components/store/RecipeGrid.tsx', /<RecipeName recipe=\{r\}/],
    ['components/store/ProductDetail.tsx', /<RecipeName recipe=\{recipe\} size=\{38\} as="h1" \/>/],
    ['components/store/ProductDetail.tsx', /<RecipeName recipe=\{r\} size=\{18\} as="strong" stack \/>/],
    ['components/store/StoreMenu.tsx', /<RecipeName recipe=\{r\}/],
    ['components/store/CartView.tsx', /<RecipeName recipe=\{l\.item\.recipe\}/],
    ['components/store/CartView.tsx', /<RecipeName recipe=\{g\.recipe\}/],
  ]
  for (const [rel, re] of uses) assert.match(code(...rel.split('/')), re, `${rel}: 레시피 이름이 RecipeName(치킨 레시피 + 닭고기 화식)이 아니다`)
  // 상세 제목에 상품 이름만 크게 쓰던 예전 모양이 없다
  assert.doesNotMatch(code('components', 'store', 'ProductDetail.tsx'), /<h1 className="d"[^>]*>\s*\{RECIPE_PRODUCT_NAME\[recipe\]\}/, '상세 제목이 아직 "닭고기 화식"만 크게 쓴다')
  // 제공고시 제품명은 상품 이름
  assert.match(code('components', 'store', 'ProductDetail.tsx'), /\['제품명', `\$\{RECIPE_PRODUCT_NAME\[recipe\]\} \$\{size\}`\]/, '제공고시 제품명이 상품 이름(닭고기 화식)이 아니다')
})

test('규칙293: 홈 순서·정기배송 줄 한 번·행사는 진행 중만·매거진은 공개 글만·손으로 옮긴 별점엔 본 날짜', async () => {
  const home = code('app', 'page.tsx')
  const body = home.slice(home.indexOf('export default async function HomePage'))
  assert.ok(body.length > 1000, '홈 화면 본문을 못 찾았다')
  const ORDER = ['<ShipLine />', '<ProofGrid />', '<RecipeGrid paused={storeSalesPaused()} />', '<TrialCard />', '<ReviewBlock />', '<EventStrip events={events} />', '<HomeCalculator />', '손질부터 배송까지', '<MagazineList posts={posts} />', '<StoreFaq items={FAQ} />']
  let at = -1
  for (const mark of ORDER) {
    const i = body.indexOf(mark)
    assert.ok(i > at, `홈 순서가 어긋났다: ${mark} 가 없거나 앞 칸보다 위에 있다`)
    at = i
  }
  assert.equal(home.split('매일 먹인다면').length - 1, 1, "홈에 '매일 먹인다면 앱 정기배송' 줄이 한 번이 아니다(광고 띠처럼 반복)")
  assert.doesNotMatch(home, /RECIPE_BAND/, '홈이 레시피 색을 직접 칠한다(띠가 돌아왔다)')

  // 행사 = /link 배너 중 진행 중인 것만(마감 회색·시작 전·스마트스토어 카드 제외)
  assert.match(home, /content\.banners\.filter\(\(b\) => b\.window === 'active' && b\.variant !== 'products'\)/, '홈 행사 띠가 진행 중인 배너만 고르지 않는다')
  // 매거진 = 공개 글만, 쿠키 없는 조회(이 화면은 1시간 캐시 — 쿠키를 읽으면 매 요청 새로 그린다)
  assert.match(home, /\.from\('blog_posts'\)[\s\S]{0,120}\.eq\('is_published', true\)/, '홈 매거진이 공개 글만 고르지 않는다')
  assert.doesNotMatch(home, /from '@\/lib\/supabase\/server'/, '홈이 쿠키 클라이언트를 쓴다(캐시가 깨진다)')
  assert.match(home, /export const revalidate = 3600/, '홈 캐시(1시간)가 빠졌다')
  // 손으로 옮긴 스마트스토어 숫자 = 본 날짜를 같이 적고 화면에도 보인다
  assert.match(home, /const SMARTSTORE_RATING = \{ stars: '[\d.]+', reviews: \d+, asOf: '\d+월 \d+일' \} as const/, '스마트스토어 별점에 본 날짜가 없다')
  assert.match(home, /\{SMARTSTORE_RATING\.asOf\} 기준/, '별점 칸에 "○월 ○일 기준"이 보이지 않는다')
  // 무항생제 = 닭가슴살·오리 안심만(흑돼지·한우에는 붙이지 않는다 — 메모리 정본)
  const c = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  assert.deepEqual(Object.keys(c.ANTIBIOTIC_FREE_MAIN).sort(), ['chicken', 'duck'])
  assert.match(home, />\s*무항생제\s*<\/span>\s*<span style=\{small\}>닭가슴살·오리 안심<\/span>/, '증거 칸 무항생제가 닭가슴살·오리 안심으로 한정되지 않는다')
  // 후기 칸은 게시 동의를 받은 후기 정본에서만
  assert.match(home, /const r = STORE_REVIEWS\[0\]\s*\n\s*if \(!r\) return null/, '홈 후기가 후기 정본(lib/store/reviews)에서 오지 않는다')
  // 상세 후기 칸으로 바로 가는 주소가 실제로 있다
  assert.match(code('components', 'store', 'ProductDetail.tsx'), /<section id="reviews"/, "상세 화면에 '#reviews' 자리가 없다")
})
