/**
 * 2026-10-17 웹 첫 화면 다시 짜기(사장님 "첫화면만 좀 다시짜볼까 … 체험팩 14900원 … 치킨 레시피 바로옆에 작은 글씨로 닭고기 화식 …
 * 색 들어가는 데마다 위에 띠가 있는데 AI 티") — 규칙 291~293. 체험팩 값은 규칙199(lib/audit-rules-1013-ops.test.ts)가 지킨다.
 *
 *   291 레시피 색 띠 없음 — 사진·카드 위(또는 머리) 가로 띠, 카드 위 색 테두리, 4색 띠, 머리말 색 막대. 작은 네모 표시는 괜찮다.
 *   292 가게 이름 = 큰 '치킨 레시피' + 바로 옆 작은 '닭고기 화식'(부품 하나) — 주문서·영수증·제공고시 이름은 그대로 '닭고기 화식'
 *   293 홈 순서 = 증거 → 레시피 → 체험팩 → 후기 → 행사 → 계산기 → 만드는 과정 → 매거진 → 질문, 정기배송 줄은 한 번,
 *       행사는 진행 중인 것만, 매거진은 공개 글만(쿠키 없는 조회), 손으로 옮긴 별점엔 본 날짜
 *   294 네이버 스마트스토어 후기(사장님 10/17 "스마트스토어 후기라는 거 달아 놓고, 아이디도 저 ***** 그대로") — 출처 딱지·가린 아이디·별점·날짜,
 *       글은 그대로(맞춤법도), 다른 회사 이름·제품 사진은 뺌, 웹 상세가 없는 상품(큐브·케이크) 후기는 화면에 안 뜸, 영상은 소리 없이·포스터·저전력 대비
 *   295 웹 문구 정리(10/18) — 레시피 페르소나는 "○○ 같은 아이를 떠올리며"(손님 사연처럼 쓰지 않음), 후기 빈칸 문구 없음, 후기 화면 다시 열림, 웹엔 맞춤 없음
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
  // 10/17 오후: 손으로 적은 '10건'이 그날 후기 하나로 바로 틀려서 → 옮겨 둔 후기에서 센다(규칙294)
  assert.match(home, /const SMARTSTORE_RATING = smartstoreSummary\(\)/, '스마트스토어 별점·후기 수를 손으로 적었다(옮긴 후기에서 세지 않는다)')
  assert.match(home, /\{SMARTSTORE_RATING\.asOf\} 기준/, '별점 칸에 "○월 ○일 기준"이 보이지 않는다')
  const rvs = await load<typeof import('./store/reviews.ts')>('lib', 'store', 'reviews.ts')
  const sum = rvs.smartstoreSummary()
  const shownSs = rvs.STORE_REVIEWS.filter((r) => r.source === 'smartstore' && r.recipe !== null)
  assert.equal(sum.reviews, shownSs.length, '홈 후기 수가 화식 상세에 옮긴 스마트스토어 후기 수와 다르다')
  assert.ok(Number(sum.stars) <= Math.max(...shownSs.map((r) => r.rating ?? 0)), '홈 별점이 실제 후기 별점보다 높다')
  assert.match(sum.asOf, /^\d{1,2}월 \d{1,2}일$/, '홈 별점 기준 날이 "○월 ○일"이 아니다')
  // 무항생제 = 닭가슴살·오리 안심만(흑돼지·한우에는 붙이지 않는다 — 메모리 정본)
  const c = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  assert.deepEqual(Object.keys(c.ANTIBIOTIC_FREE_MAIN).sort(), ['chicken', 'duck'])
  assert.match(home, />\s*무항생제\s*<\/span>\s*<span style=\{small\}>닭가슴살·오리 안심<\/span>/, '증거 칸 무항생제가 닭가슴살·오리 안심으로 한정되지 않는다')
  // 후기 칸은 후기 정본에서만(크게 한 편 + 스마트스토어 작은 카드 — 규칙294)
  assert.match(home, /const r = reviewById\(HOME_FEATURED_REVIEW\)/, '홈 후기가 후기 정본(lib/store/reviews)에서 오지 않는다')
  assert.match(home, /HOME_MORE_REVIEWS\.map\(reviewById\)/, '홈 작은 후기 카드가 후기 정본에서 오지 않는다')
  // 상세 후기 칸으로 바로 가는 주소가 실제로 있다
  assert.match(code('components', 'store', 'ProductDetail.tsx'), /<section id="reviews"/, "상세 화면에 '#reviews' 자리가 없다")
})

test('규칙294: 네이버 스마트스토어 후기 — 출처 딱지·가린 아이디 그대로·별점·날짜, 글은 그대로, 다른 회사 이름 없음, 웹 상세 없는 상품 후기는 안 뜸, 영상은 소리 없이', async () => {
  /**
   * 사장님 10/17: 스마트스토어 후기 캡처 14장을 보내며 "걍 올려, 네이버 스마트스토어 후기라는 거 달아 놓고, 네이버 아이디도 저 ***** 그대로".
   * 큐브·케이크 후기는 "일단 리뷰로 만들어 놓고 — 지금은 상세페이지가 없음". 다른 회사 이름(디어니스트키친)은 가리고, 다른 회사 사료
   * 봉지(닥터클라우더 '알러지 케어')가 크게 나온 사진은 뺐다 — 우리 광고에 남의 상표·효능 문구가 실린다.
   */
  const rv = await load<typeof import('./store/reviews.ts')>('lib', 'store', 'reviews.ts')
  const c = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  const ss = rv.STORE_REVIEWS.filter((r) => r.source === 'smartstore')
  assert.ok(ss.length >= 13, `스마트스토어 후기가 ${ss.length}편뿐이다(10/17 옮긴 13편이 빠졌다)`)
  assert.equal(new Set(rv.STORE_REVIEWS.map((r) => r.id)).size, rv.STORE_REVIEWS.length, '후기 id 가 겹친다')
  for (const r of ss) {
    assert.match(r.reviewerId ?? '', /^[0-9A-Za-z]+\*+$/, `${r.id}: 아이디가 네이버에 보이는 가린 모양(앞 몇 글자 + ***)이 아니다`)
    assert.ok(Number.isInteger(r.rating) && (r.rating as number) >= 1 && (r.rating as number) <= 5, `${r.id}: 별점이 1~5 가 아니다`)
    assert.match(r.date ?? '', /^\d{4}-\d{2}-\d{2}$/, `${r.id}: 남긴 날이 없다`)
    assert.ok(r.note.includes('네이버 스마트스토어'), `${r.id}: 어디서 옮겼는지(네이버 스마트스토어)를 밝히지 않는다`)
    assert.equal(r.title, null, `${r.id}: 스마트스토어 후기에 우리가 고른 제목을 붙였다(글은 그대로)`)
    assert.equal(r.dogName, null, `${r.id}: 스마트스토어 후기에 강아지 이름을 지어 붙였다`)
    assert.equal(rv.reviewerLabel(r), r.reviewerId, `${r.id}: 화면에 가린 아이디 그대로가 나오지 않는다`)
  }
  for (const r of rv.STORE_REVIEWS.filter((x) => x.source === 'instagram')) {
    assert.equal(r.reviewerId, null, `${r.id}: 인스타 후기에 아이디가 있다`)
    assert.equal(r.rating, null, `${r.id}: 인스타 후기에 별점이 있다(받지 않았다)`)
  }
  // 글은 그대로 — 맞춤법을 고치지 않았다(카나리아 두 편)
  assert.equal(rv.STORE_REVIEWS.find((r) => r.id === 'ss-hatc-1017-chicken')?.body, '잘먹어서 두번째 구매입니다!')
  assert.ok(rv.STORE_REVIEWS.find((r) => r.id === 'ss-zira-1009-duck')?.body.includes('저켓오요'), '손님 글의 맞춤법을 고쳤다(그대로 옮긴다)')
  // 다른 회사 이름 없음
  const OTHER_BRANDS = /디어니스트|닥터\s?클라우더|clauder|로얄\s?캐닌|royal\s?canin|오리젠|orijen|힐스|hill'?s|퓨리나|purina/i
  for (const r of rv.STORE_REVIEWS) assert.doesNotMatch(`${r.body} ${r.photos.map((p) => p.alt + (p.caption ?? '')).join(' ')}`, OTHER_BRANDS, `${r.id}: 다른 회사 이름이 있다`)

  // 웹 상세가 없는 상품(큐브·케이크) 후기 = 데이터로만 — 어떤 레시피 상세에도, 홈에도 안 뜬다
  const hidden = rv.STORE_REVIEWS.filter((r) => r.recipe === null)
  assert.ok(hidden.length >= 3, '큐브·케이크 후기(데이터로만 넣어 둔 것)가 빠졌다')
  assert.ok(hidden.every((r) => r.productKey !== undefined), '웹 상세 없는 상품 후기에 상품 열쇠(productKey)가 없다 — 나중에 붙일 곳을 잃는다')
  assert.ok(rv.STORE_REVIEWS.filter((r) => r.productKey).every((r) => r.recipe === null), '큐브·케이크 후기가 화식 레시피에 붙었다(다른 상품 후기가 화식 상세에 뜬다)')
  // 스마트스토어 옵션 이름 = 붙인 레시피(닭고기 → 치킨 레시피 상세) — 다른 레시피 후기를 엉뚱한 상세에 붙이지 않는다
  for (const r of ss.filter((x) => x.recipe !== null)) assert.ok(r.product.startsWith(c.RECIPE_NAME[r.recipe!]), `${r.id}: 산 상품(${r.product})과 붙인 레시피(${r.recipe})가 다르다`)
  for (const recipe of c.STORE_RECIPES) {
    const list = rv.reviewsFor(recipe)
    assert.ok(list.every((r) => r.recipe === recipe), `${recipe} 상세에 다른 상품 후기가 섞였다`)
  }
  const shown = c.STORE_RECIPES.flatMap((recipe) => rv.reviewsFor(recipe))
  assert.equal(shown.length + hidden.length, rv.STORE_REVIEWS.length, '어느 화면에도 안 가는 후기가 있다(레시피도 상품 열쇠도 아님)')
  assert.ok(shown.length >= 12, '화식 상세에 뜨는 후기가 줄었다')
  for (const r of shown) assert.ok(r.photos.length > 0 || r.video !== undefined, `${r.id}: 화면에 뜨는 후기에 사진·영상이 없다`)
  assert.equal(rv.reviewById('ss-mjy1-1011-cube'), null, '웹 상세 없는 상품 후기를 홈이 고를 수 있다')
  // 홈 = 크게 한 편 + 스마트스토어 작은 카드(레시피마다 다른 것)
  assert.ok(rv.reviewById(rv.HOME_FEATURED_REVIEW), '홈 큰 후기가 없다')
  const more = rv.HOME_MORE_REVIEWS.map((id) => rv.reviewById(id))
  assert.ok(more.every((r) => r !== null && r.source === 'smartstore'), '홈 작은 카드가 화면에 뜨는 스마트스토어 후기가 아니다')
  assert.equal(new Set(more.map((r) => r?.recipe)).size, more.length, '홈 작은 카드가 같은 레시피를 겹쳐 고른다')

  // 영상 = 정사각형 포스터 · 3MB 이하 · 소리 트랙 없음
  const sharp = (await import('sharp')).default
  for (const r of rv.STORE_REVIEWS.filter((x) => x.video)) {
    const v = r.video!
    const file = join(ROOT, 'public', ...v.src.split('/').filter(Boolean))
    const buf = readFileSync(file)
    assert.ok(buf.length > 10_000 && buf.length < 3_000_000, `${v.src}: 영상 크기가 이상하다(${buf.length})`)
    assert.ok(!buf.includes(Buffer.from('soun')), `${v.src}: 소리 트랙이 남았다(화면 녹화 소리 — 빼고 올린다)`)
    const m = await sharp(join(ROOT, 'public', ...v.poster.split('/').filter(Boolean))).metadata()
    assert.equal(m.width, m.height, `${v.poster}: 영상 포스터가 정사각형이 아니다`)
  }
  // 화면 부품 — 출처 딱지(초록 + 검정 글자), 영상은 소리 없이·화면에 보일 때만·막히면 재생 단추
  const media = code('components', 'store', 'ReviewMedia.tsx')
  assert.match(media, /네이버 스마트스토어 후기/, '출처 딱지 글자가 없다')
  assert.match(media, /background: NAVER_GREEN, color: '#141414'/, '출처 딱지가 초록 바탕 검정 글자가 아니다(흰 글자는 대비 2.3:1)')
  for (const re of [/\bmuted\b/, /\bplaysInline\b/, /poster=\{poster\}/, /preload="none"/, /new IntersectionObserver/, /\.catch\(\(\) => setBlocked\(true\)\)/, /controls=\{blocked\}/]) {
    assert.match(media, re, `후기 영상 부품에 ${re} 가 없다(소리·자동 재생·저전력 대비)`)
  }
  assert.match(media, /\{reviewerLabel\(r\)\}/, '스마트스토어 후기 화면에 아이디가 안 나온다')
  assert.match(media, /\{reviewDate\(r\.date\)\}/, '스마트스토어 후기 화면에 날짜가 안 나온다')
  const pd = code('components', 'store', 'ProductDetail.tsx')
  assert.match(pd, /reviews\.filter\(\(r\) => r\.source === 'smartstore'\)\.map\(\(r\) => \(\s*<SmartstoreReview key=\{r\.id\} r=\{r\} \/>/, '상세 화면이 스마트스토어 후기를 출처 딱지 부품으로 그리지 않는다')
  assert.match(pd, /reviews\.filter\(\(r\) => r\.source === 'instagram'\)\.map\(/, '상세 화면 인스타 후기 큰 카드가 빠졌다')
})

test('규칙295: 웹 문구 정리(10/18) — 레시피 페르소나는 손님 사연처럼 쓰지 않음·후기 빈칸 문구 없음·후기 화면 다시 열림·웹엔 맞춤 없음', async () => {
  /**
   * 사장님 10/18: "탄생 이야기는 거창함을 살짝만 줄이고 페르소나로 지정, 대놓고 지어냈다는 티는 안 나게 … 이 외에 전부 진행".
   * 페르소나는 '○○ 같은 아이를 떠올리며' — 실제 있었던 일처럼 읽히던 전언(~했대요)·병원 장면은 뺐다(실제 손님 이야기는 후기에만).
   * 후기를 11편 올린 뒤에도 우리 음식·브랜드 이야기 화면이 '첫 후기를 모으는 중이에요'라고 말하고 있었다.
   */
  const rd = await load<typeof import('./recipe-detail.ts')>('lib', 'recipe-detail.ts')
  for (const [p, s] of Object.entries(rd.RECIPE_STORY)) {
    assert.match(s.hand, /^.+ 같은 아이를 떠올리며$/, `${p}: 페르소나 제목이 '○○ 같은 아이를 떠올리며'가 아니다`)
    const text = s.paragraphs.join(' ')
    assert.doesNotMatch(text, /(했|었|였|있었)대요|병원에서|보호자는 /, `${p}: 페르소나가 실제 있었던 일(전언·병원·보호자 행동)처럼 쓰였다`)
    assert.match(s.paragraphs[0]!, /그런 아이예요\.$/, `${p}: 첫 문단이 '○○는 그런 아이예요'로 끝나지 않는다(묘사형 페르소나)`)
  }
  const qr = code('app', 'recipe', '[protein]', 'page.tsx')
  assert.match(qr, />만든 이유<\/span>/, "QR 레시피 화면 머리말이 '만든 이유'가 아니다(제목이 이미 '○○ 같은 아이를 떠올리며')")
  assert.doesNotMatch(qr, />탄생 이야기</, "QR 레시피 화면에 '탄생 이야기' 머리말이 남았다")
  assert.doesNotMatch(qr, /맞춤/, "QR 레시피 화면(웹)에 '맞춤'이 남았다")

  // 후기 빈칸 문구 — 후기를 올렸으니 우리 음식·브랜드 이야기에서 사라진다(상품 상세는 후기 없는 레시피만 '모으는 중')
  for (const rel of [['app', 'our-food', 'page.tsx'], ['app', 'about', 'page.tsx']]) {
    const src = code(...rel)
    assert.doesNotMatch(src, /첫 후기를 모으는 중/, `${rel.join('/')}: 후기를 올렸는데 '첫 후기를 모으는 중'이라고 한다`)
    assert.match(src, /<ReviewDigest reviews=\{reviewsByIds\(DIGEST_REVIEWS\)\} summary=\{smartstoreSummary\(\)\} \/>/, `${rel.join('/')}: 후기 모아 보기가 없다`)
  }
  const rv = await load<typeof import('./store/reviews.ts')>('lib', 'store', 'reviews.ts')
  const digest = rv.reviewsByIds(rv.DIGEST_REVIEWS)
  assert.equal(digest.length, rv.DIGEST_REVIEWS.length, '후기 모아 보기의 후기 중 화면에 뜨지 않는 것이 있다')
  assert.ok(rv.DIGEST_REVIEWS.every((id) => !(rv.HOME_MORE_REVIEWS as readonly string[]).includes(id)), '후기 모아 보기가 홈과 같은 후기를 고른다')

  // 후기 화면 다시 열림 — 홈으로 돌려보내지 않고, 정본에서 그리고, 없는 기능(웹 후기 쓰기) 원칙을 말하지 않는다
  const page = code('app', 'reviews', 'page.tsx')
  assert.doesNotMatch(page, /redirect\(/, '후기 화면이 아직 홈으로 돌려보낸다')
  assert.match(page, /reviewsFor\(r\)/, '후기 화면이 후기 정본(lib/store/reviews)을 읽지 않는다')
  assert.match(page, /<FeaturedReview key=\{r\.id\} r=\{r\} \/>/, '후기 화면에 인스타 후기 큰 카드가 없다')
  assert.match(page, /<SmartstoreReview key=\{r\.id\} r=\{r\} \/>/, '후기 화면에 스마트스토어 후기(출처 딱지)가 없다')
  assert.doesNotMatch(page, /주문 한 건에 하나|사진과 별점을 함께 남길 수 있어요|첫 후기를 기다려요/, '후기 화면이 없는 기능(웹 후기 쓰기)이나 빈 상태를 말한다')
  assert.match(code('app', 'sitemap.ts'), /url: `\$\{siteUrl\}\/reviews`/, '사이트맵에 후기 화면이 없다')
  assert.match(code('components', 'store', 'StoreMenu.tsx'), /<Row href="\/reviews">후기<\/Row>/, '가게 메뉴에 후기 줄이 없다')
  assert.match(code('app', 'page.tsx'), /<Link href="\/reviews"/, '홈 후기 칸에서 후기 화면으로 가는 길이 없다')

  // DB 문구(FAQ·매거진)는 운영 DB 를 바꿨고, 같은 값을 기록용 마이그레이션에 남겼다
  const mig = read('supabase', 'migrations', '20261018090000_faq_app_survey_and_blog_trial_50g.sql')
  assert.ok((mig.match(/update public\.faqs/g) ?? []).length === 8, 'FAQ 갱신 기록이 8행이 아니다')
  assert.match(mig, /앱에서 2분 설문으로 우리 아이 식단을 확인한 뒤/, "FAQ '설문'이 앱 설문으로 기록되지 않았다")
  assert.match(mig, /네 가지 맛을 50g씩 담은 \*\*체험팩\*\*/, '매거진 체험팩 50g 정정 기록이 없다')
})
