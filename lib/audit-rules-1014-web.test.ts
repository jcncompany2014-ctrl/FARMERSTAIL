/**
 * 2026-10-14 점검 묶음 '웹 — 검색·AI 신호와 법정 문서' 의 규칙 220~224 (가지 fix/1014-web).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(5866b6c8)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다(그 폴더는 저장소 안에 두어야
 * 패키지를 찾는다 — lib/audit-rules-1013-toss-store.test.ts 와 같은 방식).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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

/** 주석을 걷고 공백을 한 칸으로 — JSX 는 문장을 아무 데서나 접으므로 줄바꿈을 넘어 문장을 찾는다. */
function flat(...parts: string[]): string {
  return code(...parts).replace(/\s+/g, ' ')
}

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

/** 환경값을 잠깐 바꿔 fn 을 돌리고 되돌린다(값이 없던 것은 지운다). */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const before: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) before[k] = process.env[k]
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    return fn()
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

/** app·components 아래 .ts/.tsx 파일(저장소 기준 경로, '/' 구분). */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

test("규칙220: 결제 시험 기간(운영 + 토스 테스트 결제창 키)엔 검색·AI 신호(상품 구조화 데이터 offers · /llms.txt)를 막음 때와 같은 '준비 중' 갈래로 — 화면은 그대로", async () => {
  /**
   * # 왜 (2026-10-14 사장님 "검색·AI 만 '준비 중', 화면은 그대로")
   * 토스 심사 동안 운영엔 테스트 결제창 키만 들어 있다 → storeSalesPaused 가 거짓이 되어 상품 구조화 데이터에 InStock offers 가,
   * /llms.txt 에 "웹 가게에서는 … 팔고"가 나갔다. 실제로는 승인을 하지 않으니(규칙209) 구글 판매자 정보·AI 답이 '지금 판다'고 안내했다.
   * 화면(담기·구매·장바구니·주문서)은 그대로 열려 있어야 한다 — 심사관이 결제창까지 가야 한다. 그래서 판정을 둘로 가른다:
   * 화면 = storeSalesPaused(규칙177), 검색·AI = storeSellable(이 규칙).
   */
  const widgetSrc = code('lib', 'store', 'toss-widget.ts')
  assert.match(
    widgetSrc,
    /export function storeSellable\(\): boolean \{\s*return !storeSalesPaused\(\) && !widgetTestMode\(\)\s*\}/,
    "'지금 실제로 팔 수 있나' 판정(storeSellable = 막음 아님 && 시험 모드 아님)이 한 곳에 없다",
  )

  const w = await load<typeof import('./store/toss-widget.ts')>('lib', 'store', 'toss-widget.ts')
  assert.equal(typeof w.storeSellable, 'function', 'storeSellable 이 없다')
  const prod = { VERCEL_ENV: 'production', TOSS_WIDGET_SECRET_KEY: undefined }
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'test_gck_x' }, () => {
    assert.equal(w.storeSalesPaused(), false, '시험 기간에 화면까지 막혔다 — 심사관이 결제창에 못 간다')
    assert.equal(w.storeSellable(), false, '시험 기간(운영 + 테스트 결제창 키)인데 판다고 판정한다')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: undefined }, () => {
    assert.equal(w.storeSellable(), false, '결제 막음(키 없음)인데 판다고 판정한다')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'live_gck_x' }, () => {
    assert.equal(w.storeSellable(), true, '운영 결제창 키가 들어왔는데 검색·AI 엔 여전히 준비 중이다')
  })

  // 상품 구조화 데이터 — offers 는 storeSellable 로만. 화면 부품(ProductDetail)은 storeSalesPaused 그대로.
  const product = code('app', 'store', '[slug]', 'page.tsx')
  assert.match(product, /const paused = !storeSellable\(\)/, '상품 구조화 데이터가 시험 기간을 판다고 내보낸다(storeSellable 로 판정하지 않는다)')
  // 2026-10-19 — 못 팔 땐 offers 만이 아니라 Product 표시 통째로 뺀다(가격 없는 Product = 서치 콘솔 심각한 문제, 규칙304).
  assert.match(product, /const jsonLd = paused \? null : \{/, '못 팔 때 상품 구조화 데이터를 빼는 갈래(막음 때와 같은 갈래)가 없다')
  assert.match(product, /<ProductDetail\b[^>]*\bpaused=\{storeSalesPaused\(\)\}/, '화면 부품의 결제 막음 판정이 바뀌었다 — 화면은 그대로여야 한다')

  // AI 안내서 — 같은 판정, 막음 때 운영에 나가던 '준비 중' 문구 그대로(새 문구 금지).
  const llms = code('app', 'llms.txt', 'route.ts')
  assert.match(llms, /const paused = !storeSellable\(\)/, '/llms.txt 가 시험 기간을 판다고 말한다(storeSellable 로 판정하지 않는다)')
  assert.ok(!/storeSalesPaused/.test(llms), '/llms.txt 가 아직 화면용 판정(storeSalesPaused)을 쓴다')
  assert.ok(llms.includes("'웹 가게는 결제를 준비 중이고(그동안 레시피 4종 단품은 네이버 스마트스토어에서도 만날 수 있어요)'"), "/llms.txt 의 '준비 중' 문구가 막음 때 나가던 것과 다르다")
  assert.ok(llms.includes('웹 가게 결제는 준비 중이에요.'), "/llms.txt 의 가격 칸 '준비 중' 줄이 없다")

  // storeSellable 은 검색·AI 두 곳만 쓴다 — 화면 파일이 쓰기 시작하면 시험 기간에 화면이 막힌다(심사 불가).
  const users = [...sourceFiles('app'), ...sourceFiles('components')].filter((f) => /\bstoreSellable\b/.test(code(...f.split('/'))))
  assert.deepEqual(users.sort(), ['app/llms.txt/route.ts', 'app/store/[slug]/page.tsx'], `storeSellable 을 화면 파일이 쓴다: ${users.join(', ')}`)
})

test('규칙221: 상품 구조화 데이터의 반품 배송비는 상품마다 정본으로 — 무료배송(5만 원 이상)으로 받는 상품은 왕복', async () => {
  /**
   * # 왜 (2026-10-14 점검)
   * returnShippingFeesAmount 가 편도(RETURN_SHIPPING_FEE) 고정이라 무료배송인 1kg 3종(오리·흑돼지·한우)도 편도 금액으로 나갔다.
   * 정책(배송·교환·환불 정책 5항·약관 제9조 ④)은 무료배송으로 받았다면 왕복이다. 이 상품만 살 때의 배송비로 편도·왕복을 가른다.
   */
  const product = code('app', 'store', '[slug]', 'page.tsx')
  assert.match(
    product,
    /returnShippingFeesAmount: \{ '@type': 'MonetaryAmount', value: returnShippingFeeFor\(shippingFeeFor\(it\.price\)\), currency: 'KRW' \}/,
    '상품 구조화 데이터의 반품 배송비가 상품마다 정본(returnShippingFeeFor(shippingFeeFor(가격)))이 아니다',
  )
  assert.ok(!/\bRETURN_SHIPPING_FEE\b/.test(product), '상품 구조화 데이터에 편도 고정값(RETURN_SHIPPING_FEE)이 남았다')

  // 값 — 정본 함수로 계산하면 무료배송 상품은 왕복, 나머지는 편도. 무료배송 상품이 하나도 없으면 이 규칙이 아무것도 안 지킨다.
  const ship = await load<typeof import('./store/shipping.ts')>('lib', 'store', 'shipping.ts')
  const catalog = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  let freeCount = 0
  for (const r of catalog.STORE_RECIPES) {
    for (const size of ['500g', '1kg'] as const) {
      const it = catalog.storeItem(`${r}-${size}`)
      const fee = ship.returnShippingFeeFor(ship.shippingFeeFor(it.price))
      if (it.price >= ship.FREE_SHIPPING_MIN) {
        freeCount++
        assert.equal(fee, ship.RETURN_SHIPPING_FEE * 2, `${it.id}: 무료배송 상품의 반품 배송비가 왕복이 아니다`)
      } else {
        assert.equal(fee, ship.RETURN_SHIPPING_FEE, `${it.id}: 배송비를 낸 상품의 반품 배송비가 편도가 아니다`)
      }
    }
  }
  assert.ok(freeCount > 0, '무료배송 상품이 하나도 없다 — 이 규칙의 검산이 비었다')
})

test("규칙222: 사업자 정보 '결제와 환불'의 단품 환불 문장은 정본(REFUND_RULE_HAEYO) + 반품 배송비 한 줄(returnFeeSummary)", () => {
  /**
   * # 왜 (2026-10-14 점검)
   * 사업자 정보만 손으로 쓴 문장("받은 날부터 7일 안에 팩을 뜯지 않았다면 환불돼요")이라 '상자를 연 건 괜찮다'와 반품 배송비가 빠져
   * 가게 화면·FAQ·약관과 달랐다. 정본 문장과 정본 한 줄을 그대로 쓴다.
   */
  const src = code('app', 'business', 'page.tsx')
  const biz = flat('app', 'business', 'page.tsx')
  assert.match(src, /import \{ REFUND_RULE_HAEYO, returnFeeSummary \} from '@\/lib\/store\/refund-copy'/, '사업자 정보가 환불 문구 정본을 읽지 않는다')
  assert.ok(
    biz.includes('웹 스토어 단품은 {REFUND_RULE_HAEYO} 단순 변심 반품 배송비는 {returnFeeSummary()}이에요. 앱 정기배송은 결제 전까지'),
    "사업자 정보 '결제와 환불'의 단품 문장이 정본 + 반품 배송비 한 줄이 아니다",
  )
  assert.ok(!biz.includes('7일 안에 팩을 뜯지 않았다면'), '사업자 정보에 손으로 쓴 옛 환불 문장이 남았다')
  assert.doesNotMatch(src, /\d{1,3},\d{3}\s*원/, '사업자 정보에 반품 배송비 금액을 손으로 적었다')
})

test("규칙223: 매거진 — 글이 없어 숨긴 카테고리 주소는 redirect 하지 않고 '전체' 목록을 그대로(정본 주소 /blog)", () => {
  /**
   * # 왜 (2026-10-14 점검)
   * /blog?category=nutrition 처럼 0편이라 숨긴 카테고리 주소가 HTTP 200 + 빈 화면 + 1초 뒤 meta refresh 였다 — 로딩 화면(loading.tsx)이
   * 먼저 흘러나간 뒤 redirect() 를 부르면 Next 는 상태 코드를 못 바꾸고 meta refresh 를 끼운다. 검색엔진에겐 빈 200 페이지다.
   * 없는 카테고리 값과 똑같이 '전체' 목록을 보여 주고, 정본 주소(canonical)는 /blog 하나. 단추 숨김·조회 실패 시 안 숨김(규칙212)은 그대로.
   */
  const page = code('app', 'blog', '(index)', 'page.tsx')
  assert.ok(existsSync(join(ROOT, 'app', 'blog', '(index)', 'loading.tsx')), 'loading.tsx 가 없어졌다 — 이 규칙의 전제(먼저 흘러나가는 로딩 화면)를 다시 보라')
  assert.ok(!/\bredirect\(/.test(page), '매거진 목록이 redirect 한다 — 로딩 화면이 먼저 나가 200 + 빈 화면 + meta refresh 가 된다')
  assert.ok(!/from 'next\/navigation'/.test(page), "매거진 목록이 next/navigation 을 읽는다(redirect·notFound 는 이 화면에서 쓰지 않는다)")
  assert.match(page, /const activeCategory = catSlug \? shownCats\.find\(\(c\) => c\.slug === catSlug\) : null/, '고른 카테고리를 보이는 카테고리(shownCats)에서 찾지 않는다')
  assert.match(page, /const rows = activeCategory \? allRows\.filter\(\(p\) => p\.category_id === activeCategory\.id\) : allRows/, "숨긴·없는 카테고리 값이 '전체' 목록으로 나오지 않는다")
  assert.match(page, /const shownCats = visibleMagazineCategories\(cats, postsErr \? null : allRows\)/, '단추 숨김·조회 실패 시 안 숨김(규칙212)이 바뀌었다')
  // 정본 주소 — 카테고리 값과 관계없이 /blog 하나(정적 metadata). 카테고리마다 따로 만드는 generateMetadata 는 없다.
  assert.match(page, /export const metadata: Metadata = \{[\s\S]*?alternates: \{ canonical: '\/blog'(?: \}|, types: )/, '매거진 목록의 정본 주소가 /blog 가 아니다')
  assert.ok(!/export (async )?function generateMetadata/.test(page), '매거진 목록이 카테고리마다 metadata 를 만든다 — 숨긴 카테고리의 정본 주소가 /blog 가 아닐 수 있다')
})

test("규칙224: 이용약관 제9조 ①은 '7일 이내 별도 사유 없이 철회'(10/13 전 문장) — 팩 조건은 ② 법정 제한 사유의 예시로만", () => {
  /**
   * # 왜 (2026-10-14)
   * 10/13 에 ①을 "7일 이내, 진공 포장(팩)을 개봉하지 않았다면"으로 바꿔 당일 시행했다. 제9조는 정기배송 회원에게도 적용되므로
   * 철회 권리에 조건을 더한 '불리한 변경'(제3조: 30일 전 공지)으로 읽힐 수 있다. ①은 예전 문장으로, 팩 조건은 ②(전자상거래법
   * 제17조 제2항 — 사용·일부 소비로 가치가 현저히 줄어든 경우)의 예시로만. 요약도 같은 뜻. 개정 이력 주석에 그 판단을 남긴다.
   */
  const raw = read('app', 'legal', 'terms', 'page.tsx')
  const src = stripComments(raw)
  const doc = src.replace(/\s+/g, ' ')
  const art = (n: number) => doc.slice(doc.indexOf(`number={${n}}`), doc.indexOf(`number={${n + 1}}`))
  const art9 = art(9)
  assert.ok(art9.length > 0, '제9조를 못 찾았다')

  // ① — 10/13 전 문장 그대로, 팩 조건 없음.
  const first = art9.slice(art9.indexOf('<li>'), art9.indexOf('</li>'))
  assert.ok(first.includes('회원은 상품 수령일로부터 7일 이내에 별도 사유 없이 청약을 철회할 수 있습니다.'), '제9조 ①이 10/13 전 문장이 아니다')
  assert.ok(!/개봉|진공 포장|팩/.test(first), '제9조 ①에 팩 조건이 붙어 있다 — 정기배송 회원에게 불리한 변경으로 읽힌다')

  // ② — 법정 제한 사유(제17조 제2항) 목록 안의 예시로.
  const second = art9.slice(art9.indexOf('</li>'), art9.indexOf('</UL>'))
  assert.ok(second.includes('전자상거래법 제17조 제2항'), '제9조 ②의 법 근거가 없다')
  assert.ok(
    second.includes('회원의 사용 또는 일부 소비로 상품의 가치가 현저히 감소한 경우 (예: 진공 포장(팩)을 개봉한 식품'),
    '팩 조건이 ② 법정 제한 사유(사용·일부 소비)의 예시로 있지 않다',
  )
  assert.ok(second.includes('확인하려고 배송 상자를 연 것은 개봉으로 보지 않습니다'), "'상자를 연 것은 개봉 아님'이 빠졌다")

  // 요약 — 같은 뜻: 7일 이내 청약철회 + 팩 개봉은 법에서 정한 제한 사유. 10/13 의 조건부 문장은 없다.
  const summary = doc.slice(0, doc.indexOf('const body'))
  assert.ok(summary.includes('상품을 받은 날부터 7일 이내에 청약철회(환불)할 수 있습니다.'), '약관 요약의 단품 문장이 7일 이내 청약철회가 아니다')
  assert.ok(summary.includes('진공 포장(팩)을 개봉한 식품처럼 법에서 정한 제한 사유에 해당하면 청약철회가 제한'), '약관 요약이 팩 개봉을 법정 제한 사유로 말하지 않는다')
  assert.ok(!doc.includes('7일 이내, 진공 포장(팩)을 개봉하지 않았다면'), '약관에 10/13 의 조건부 철회 문장이 남았다')

  // 개정 이력 — 판단을 남긴다 · 시행일은 10/14 이후.
  assert.ok(raw.includes('법정 제한 사유의 예시를 적은 것 — 회원에게 불리한 변경 아님'), '개정 이력 주석에 판단(법정 제한 사유의 예시 — 불리한 변경 아님)이 없다')
  const eff = src.match(/const EFFECTIVE_DATE = '(\d{4}-\d{2}-\d{2})'/)?.[1] ?? ''
  assert.ok(eff >= '2026-10-14', `약관 시행일이 이번 개정(10/14) 전이다: ${eff}`)

  // 환불정책 — 조건부 문장(팩을 개봉하지 않았다면)은 웹 단품 절(Ⅰ)에만. 정기배송 절(Ⅱ)로 번지면 같은 문제가 된다.
  const refund = flat('app', 'legal', 'refund', 'page.tsx')
  const iStore = refund.indexOf('title="Ⅰ. 웹 스토어 단품"')
  const iSub = refund.indexOf('title="Ⅱ. 앱 정기배송"')
  assert.ok(iStore > 0 && iSub > iStore, '환불정책의 단품·정기배송 절 순서가 바뀌었다')
  assert.ok(refund.slice(iStore, iStore + 200).includes('웹 스토어에서 낱개로 산 상품(500g·1kg·4종 체험팩)에 적용합니다.'), '환불정책 단품 절의 적용 범위(웹 단품만)가 없다')
  assert.ok(!refund.slice(iSub).includes('개봉하지 않았다면'), '환불정책 정기배송 절에 팩 미개봉 조건이 들어갔다 — 정기배송 회원에게 불리한 변경이다')
})
