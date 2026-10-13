/**
 * 2026-10-13 점검 묶음 '가게 화면·결제 시험 모드' 의 규칙 209~213 (가지 fix/1013-toss-store) — 토스 일반결제(결제위젯) 홈페이지 심사 준비.
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(54b8ecd3)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다(그 폴더는 저장소 안에 두어야
 * 패키지(@supabase/supabase-js 등)를 찾는다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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

const won = (n: number) => n.toLocaleString('ko-KR')

test('규칙209: 결제 시험 모드 — 운영 + 테스트 키(또는 시크릿 없음)면 가게 결제를 승인하지 않고(paid 금지) "돈은 나가지 않았어요", 주문서·완료 화면·어드민이 그 상태를 말한다', async () => {
  /**
   * # 왜 (2026-10-13 사장님 — 토스 일반결제 심사 동안 운영에 '테스트' 결제위젯 클라이언트 키만 넣는다)
   * 결제창은 열려야 심사가 되고, 승인은 하면 안 된다. 예전엔 시크릿이 없으면 tossSecretKey 가 throw → tossFetch 가 'TOSS_NETWORK'
   * (결제 서버와 통신할 수 없어요)로 바꿔 엉뚱한 말이 떴고, 시크릿에 test_ 키를 넣으면 시험 결제가 paid·preparing(발송 대기)이 될 수 있었다.
   * SMARTSTORE_NOTICE 는 안전망이라 true 그대로(키가 빠지면 스마트스토어 안내로 돌아간다).
   */
  const widgetSrc = read('lib', 'store', 'toss-widget.ts')
  assert.match(stripComments(widgetSrc), /export const SMARTSTORE_NOTICE = true as boolean/, 'SMARTSTORE_NOTICE 가 true 가 아니다 — 키가 빠지면 막음이 안 돌아온다')
  assert.ok(!/신청할 때 false|신청할 때\*\* false|false 로 바꿔 배포/.test(widgetSrc), "toss-widget 주석이 아직 '심사 신청 때 SMARTSTORE_NOTICE 를 false 로' — 지금 결정(키가 들어오면 저절로 열림)과 다르다")

  // 승인 라우트: 가게 주문 + 시험 판정이면 토스를 부르지 않고 실패 처리 경로로.
  const route = code('app', 'api', 'payments', 'confirm', 'route.ts')
  assert.match(route, /const storeTestOnly = merchant === 'widget' && storeConfirmTestOnly\(\)/, '승인 라우트가 가게 주문의 시험 판정(storeConfirmTestOnly)을 하지 않는다')
  assert.match(route, /const result = storeTestOnly\s*\?\s*storeTestResult\s*:\s*await traceBusiness\(/, '시험 판정이 참이어도 토스 승인을 부른다')
  assert.match(route, /code: STORE_TEST_MODE_CODE, message: STORE_TEST_MODE_MESSAGE/, '시험 판정의 응답이 STORE_TEST_MODE 코드·문구가 아니다')
  const failStart = route.indexOf('if (!result.ok) {')
  const paidWrite = route.indexOf("payment_status: isActuallyPaid ? 'paid'")
  assert.ok(failStart > 0 && paidWrite > failStart, '실패 처리 갈래가 paid 기록보다 앞에 있지 않다')
  const failBranch = route.slice(failStart, paidWrite)
  assert.match(failBranch, /update\(\{ payment_status: 'failed' \}\)/, '시험 결제가 실패(failed)로 남지 않는다')
  assert.match(failBranch, /recordPaymentEvent\(ordersAdmin,[\s\S]{0,200}eventType: 'failed'/, '시험 결제가 원장에 실패로 기록되지 않는다')
  assert.match(failBranch, /return NextResponse\.json\(\s*\{ code: result\.error\.code, message: result\.error\.message \}/, '실패 갈래가 코드·문구를 그대로 돌려주지 않는다')
  assert.equal((route.match(/payment_status: 'paid'/g) ?? []).length, 0, '승인 라우트에 조건 없는 paid 기록이 있다')

  // 판정 함수 — 운영에서만, 클라이언트 test_ · 시크릿 없음 · 시크릿 test_ 면 승인 금지. 정기결제 키는 보지 않는다.
  const w = await load<typeof import('./store/toss-widget.ts')>('lib', 'store', 'toss-widget.ts')
  assert.equal(w.STORE_TEST_MODE_CODE, 'STORE_TEST_MODE')
  assert.equal(w.STORE_TEST_MODE_MESSAGE, '지금은 결제 시험 기간이라 실제 결제는 되지 않았어요. 돈은 나가지 않았어요.')
  const prod = { VERCEL_ENV: 'production', TOSS_SECRET_KEY: 'live_sk_BILLING' }
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'test_gck_X', TOSS_WIDGET_SECRET_KEY: undefined }, () => {
    assert.equal(w.widgetTestMode(), true, '운영 + 테스트 결제창 키인데 시험 모드가 아니다')
    assert.equal(w.storeSalesPaused(), false, '테스트 결제창 키가 들어왔는데 가게가 여전히 막혀 있다(심사가 안 된다)')
    assert.equal(w.storeConfirmTestOnly(), true, '시크릿 없음 + 테스트 결제창 키인데 승인을 시도한다')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'live_gck_X', TOSS_WIDGET_SECRET_KEY: undefined }, () => {
    assert.equal(w.storeConfirmTestOnly(), true, '운영에 시크릿이 없는데 승인을 시도한다(TOSS_NETWORK 로 위장)')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'live_gck_X', TOSS_WIDGET_SECRET_KEY: 'test_gsk_X' }, () => {
    assert.equal(w.storeConfirmTestOnly(), true, '운영에 테스트 시크릿인데 승인을 시도한다 — 시험 결제가 paid 가 된다')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: 'live_gck_X', TOSS_WIDGET_SECRET_KEY: 'live_gsk_X' }, () => {
    assert.equal(w.widgetTestMode(), false)
    assert.equal(w.storeConfirmTestOnly(), false, '운영 키 둘 다인데 승인을 막는다')
  })
  withEnv({ ...prod, NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: undefined, TOSS_WIDGET_SECRET_KEY: undefined }, () => {
    assert.equal(w.storeSalesPaused(), true, '키가 빠졌는데 스마트스토어 안내로 돌아가지 않는다')
  })
  withEnv({ VERCEL_ENV: 'preview', NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY: undefined, TOSS_WIDGET_SECRET_KEY: undefined }, () => {
    assert.equal(w.widgetTestMode(), false, '미리보기에서 시험 모드 안내가 뜬다')
    assert.equal(w.storeConfirmTestOnly(), false, '미리보기(문서 테스트 키)에서 흐름을 끝까지 시험할 수 없다')
  })

  // 주문서: 결제 버튼 위 안내 — 서버가 판정해 넘긴다.
  const checkout = code('components', 'store', 'CheckoutClient.tsx')
  assert.match(checkout, /\btestMode: boolean\b/, '주문서가 시험 모드를 받지 않는다')
  assert.match(
    checkout,
    /\{testMode && !paused && \([\s\S]{0,300}지금은 토스 결제 연동을 시험하는 기간이에요\. 결제창은 열리지만 실제 결제·배송은 되지 않아요\./,
    '주문서에 결제 시험 기간 안내가 없다',
  )
  assert.ok(checkout.indexOf('지금은 토스 결제 연동을 시험하는') < checkout.indexOf('onClick={pay}'), '시험 안내가 결제 버튼 위에 있지 않다')
  assert.match(code('app', 'store', 'checkout', 'page.tsx'), /testMode=\{widgetTestMode\(\)\}/, '주문서 화면이 시험 모드 판정(widgetTestMode)을 넘기지 않는다')

  // 완료 화면: 승인 라우트 문구를 그대로, 제목도 시험 기간으로.
  const confirm = code('components', 'store', 'ConfirmPayment.tsx')
  assert.match(confirm, /setTestMode\(data\?\.code === 'STORE_TEST_MODE'\)/, '완료 화면이 STORE_TEST_MODE 를 알아보지 못한다')
  assert.match(confirm, /setError\(data\?\.message \?\?/, '완료 화면이 서버 문구를 그대로 보이지 않는다')
  assert.ok(confirm.includes('지금은 결제 시험 기간이에요'), '완료 화면 제목이 시험 기간을 말하지 않는다')

  // 어드민: 웹 가게 결제 키 줄 — 같은 판정, 키 값은 내보내지 않는다.
  const admin = code('app', 'admin', 'page.tsx')
  assert.match(
    admin,
    /describeStoreWidgetKeyStatus\(\s*tossKeyStatus\(\s*process\.env\.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY,\s*process\.env\.TOSS_WIDGET_SECRET_KEY,?\s*\),?\s*\)/,
    '어드민 결제 키 상태판에 웹 가게 결제 줄이 없다',
  )
  const km = await load<typeof import('./payments/key-mode.ts')>('lib', 'payments', 'key-mode.ts')
  const testOnly = km.describeStoreWidgetKeyStatus(km.tossKeyStatus('test_gck_SECRETVALUE', undefined))
  assert.equal(testOnly.tone, 'warn')
  assert.match(testOnly.title, /시험 모드/)
  assert.ok(!JSON.stringify(testOnly).includes('SECRETVALUE'), '어드민 문구에 키 값이 샌다')
  assert.equal(km.describeStoreWidgetKeyStatus(km.tossKeyStatus('live_gck_A', undefined)).tone, 'danger', '운영 결제창 키 + 시크릿 없음이 위험으로 안 보인다')
  assert.equal(km.describeStoreWidgetKeyStatus(km.tossKeyStatus('live_gck_A', 'live_gsk_B')).tone, 'ok')
})

test('규칙210: 상품 상세 — 배송·교환·환불 칸은 처음부터 펼치고, 환불 조건은 정본 문구 하나, 반품 배송비는 정본 상수로', async () => {
  /**
   * # 왜 (2026-10-13 사장님 — 반품 배송비 편도 5,000원 · 무료배송이면 왕복 10,000원, 환불 조건 문구를 하나로)
   * 심사는 상품 화면에서 교환·환불 조건과 반품 배송비를 찾는다. 접힌 칸 속 "뜯지 않은 상품만"은 무엇을 뜯는지(상자? 팩?) 모호했고
   * 반품 배송비는 아예 없었다. 숫자는 lib/store/shipping(RETURN_SHIPPING_FEE·returnShippingFeeFor)만 — 화면에 박지 않는다.
   */
  const detail = code('components', 'store', 'ProductDetail.tsx')
  assert.match(detail, /<Acc title="배송·교환·환불" id="shipping" open>\s*<ShippingRefundInfo \/>/, '상품 상세의 배송·교환·환불 칸이 처음부터 펼쳐져 있지 않거나 공용 본문을 쓰지 않는다')
  assert.ok(!detail.includes('뜯지 않은 상품만') && !detail.includes('뜯지 않았다면 환불돼요.{'), '상품 상세에 옛 환불 문구가 남아 있다')
  assert.match(detail, /\{REFUND_RULE_HAEYO\}/, '구매 버튼 아래 환불 한 줄이 정본 문구가 아니다')
  assert.ok(!detail.includes('로도 주문할 수 있어요'), '상품 상세가 전화 주문을 안내한다(토스 밖 직거래로 읽힌다)')

  const info = code('components', 'store', 'ProductInfo.tsx')
  assert.match(info, /\['반품 배송비', `단순 변심이면 \$\{returnFeeSummary\(\)\}`\]/, '배송·교환·환불 칸에 반품 배송비 줄이 없다')
  assert.match(info, /\['단순 변심', REFUND_RULE_HAEYO\]/, '배송·교환·환불 칸의 환불 조건이 정본 문구가 아니다')
  assert.match(info, /\['환불 방법', REFUND_METHOD_HAEYO\]/, '배송·교환·환불 칸에 환불 방법(카드 승인 취소·간편결제)이 없다')
  for (const rel of ['components/store/ProductInfo.tsx', 'components/store/ProductDetail.tsx', 'components/store/CheckoutClient.tsx', 'components/store/StoreBrowse.tsx']) {
    const src = code(...rel.split('/'))
    assert.ok(!/\b(5|10),000원|5000원|10000원/.test(src), `${rel}: 반품·배송 금액을 화면에 숫자로 박았다 — lib/store/shipping 상수를 쓸 것`)
  }

  const copy = await load<typeof import('./store/refund-copy.ts')>('lib', 'store', 'refund-copy.ts')
  assert.equal(copy.REFUND_RULE_HAEYO, '받은 날부터 7일 안, 팩(진공 포장)을 뜯지 않았다면 환불돼요. 상자를 열어 확인한 건 괜찮아요.')
  assert.equal(
    copy.REFUND_RULE_HAMNIDA,
    '상품을 받은 날부터 7일 이내, 진공 포장(팩)을 개봉하지 않았다면 청약철회(환불)할 수 있습니다. 상품을 확인하려고 배송 상자를 연 것은 개봉으로 보지 않습니다.',
  )
  assert.match(copy.REFUND_METHOD_HAEYO, /카드는 승인 취소, 간편결제는 결제한 수단으로 취소/)
  const ship = await load<typeof import('./store/shipping.ts')>('lib', 'store', 'shipping.ts')
  assert.equal(copy.returnFeeSummary(), `편도 ${won(ship.RETURN_SHIPPING_FEE)}원 · 무료배송이면 왕복 ${won(ship.RETURN_SHIPPING_FEE * 2)}원`)
  assert.equal(copy.returnFeeSummary(), '편도 5,000원 · 무료배송이면 왕복 10,000원', '사장님 결정(10/13) 반품 배송비와 다르다')
  assert.equal(copy.returnFeeForOrder(ship.SHIPPING_FEE), `편도 ${won(ship.RETURN_SHIPPING_FEE)}원`)
  assert.equal(copy.returnFeeForOrder(0), `무료배송이라 왕복 ${won(ship.RETURN_SHIPPING_FEE * 2)}원`)

  // 주문서도 같은 정본 + 이 주문의 반품 배송비 · 키 없음 문장은 '묻는 곳'으로.
  const checkout = code('components', 'store', 'CheckoutClient.tsx')
  assert.match(checkout, /\{REFUND_RULE_HAEYO\}[^<]{0,40}\{returnFeeForOrder\(s\.shippingFee\)\}/, '주문서 환불 문구가 정본이 아니거나 반품 배송비가 없다')
  assert.ok(!checkout.includes('뜯지 않은 상품은 환불돼요'), '주문서에 옛 환불 문구가 남아 있다')
  assert.ok(!checkout.includes('주문을 도와드려요') && !checkout.includes('카카오톡으로 주문하기'), '주문서가 전화·카카오톡 주문을 안내한다(토스 밖 직거래로 읽힌다)')
  assert.ok(checkout.includes('궁금한 점은 전화(') && checkout.includes('물어보세요'), "주문서 결제 준비 안내가 '물어보세요'가 아니다")
})

test('규칙211: 체험팩 탭 — 상세 화면이 없으니 배송·교환·환불·상품정보 제공고시 칸을 같은 부품으로, 제공고시는 레시피 4종 DB 라벨에서 · 체험팩은 50g', async () => {
  /**
   * # 왜 (2026-10-13 토스 심사 준비)
   * 체험팩은 상세 화면이 없어 가격·원재료뿐이었다 — 판매 상품마다 필요한 제공고시·교환·환불 정보가 없었다.
   * 값은 지어내지 않는다: 레시피 4종의 DB 라벨(lib/store/label)에서 같으면 한 번, 다르면 레시피별로. 내용량·가격은 상품표(catalog).
   * 체험팩은 4종 50g씩(사장님 10/12) — 예전 100g 상수(PACK_G)를 체험팩 문구에 쓰던 곳이 있었다(후기 화면).
   */
  const browse = code('components', 'store', 'StoreBrowse.tsx')
  const trialStart = browse.indexOf('function TrialPanel(')
  const trialEnd = browse.indexOf('export default function StoreBrowse(')
  assert.ok(trialStart > 0 && trialEnd > trialStart, 'TrialPanel 을 못 찾았다 — 검사가 망가졌다')
  const trial = browse.slice(trialStart, trialEnd)
  assert.match(trial, /<Acc title="배송·교환·환불"[^>]*open>\s*<ShippingRefundInfo \/>/, '체험팩 탭에 배송·교환·환불 칸이 없거나 접혀 있다')
  assert.match(trial, /<Acc title="상품정보 제공고시"[\s\S]{0,200}<NoticeList rows=\{notice\} \/>/, '체험팩 탭에 상품정보 제공고시 칸이 없다')
  assert.match(browse, /trialNotice: \[string, string\]\[\] \| null/, '체험팩 제공고시를 서버에서 받지 않는다')
  const page = code('app', 'store', 'page.tsx')
  assert.match(page, /const labels = await fetchRecipeLabels\(\)/, '스토어 화면이 레시피 4종 라벨을 읽지 않는다')
  assert.match(page, /trialNoticeRows\(labels, \{ phone: business\.phone \}\)/, '스토어 화면이 체험팩 제공고시를 라벨로 만들지 않는다')
  assert.match(page, /<StoreBrowse\b[^>]*\btrialNotice=\{trialNotice\}/, '스토어 화면이 체험팩 제공고시를 넘기지 않는다')

  // 체험팩 문구에 단품 팩 무게(PACK_G=100)를 쓰지 않는다 — 웹 화면 전수.
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) {
        const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'))
        if (/[^_]PACK_G\}g씩/.test(src) || /체험팩[^\n]{0,40}100g씩|100g씩[^\n]{0,40}체험팩/.test(src)) offenders.push(rel)
      }
    }
  }
  for (const d of ['app', 'components', 'lib']) walk(d)
  assert.deepEqual(offenders, [], `체험팩을 100g씩이라 하는 곳: ${offenders.join(', ')}`)

  // 제공고시 줄 — 운영 DB 라벨(2026-10-13 조회) 모양 그대로의 예시로.
  const catalog = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  const label = await load<typeof import('./store/label.ts')>('lib', 'store', 'label.ts')
  const base = {
    isActive: true,
    manufacturer: '파머스테일',
    manufacturerAddress: '인천광역시 연수구 송도과학로28번길 50',
    manufactureDatePolicy: '제품 포장 표기',
    shelfLifeDays: 180,
    storageMethod: '영하 18℃ 이하 냉동 보관.',
    petFoodClass: '배합사료(애완동물용)',
    countryOfPackaging: '대한민국',
  }
  type Labels = Parameters<typeof label.trialNoticeRows>[0]
  const labels: Labels = {
    chicken: { ...base, id: 'c', slug: 'chicken-basic', origin: '국내산 (주원료 무항생제)', certifications: ['주원료 국내산 무항생제'], sku: 'FT-C01', allergens: ['닭고기', '어류(연어유)'] },
    duck: { ...base, id: 'd', slug: 'duck-weight', origin: '국내산 (주원료 무항생제)', certifications: ['주원료 무항생제'], sku: 'FT-D02', allergens: ['오리고기', '어류(연어유)'] },
    pork: { ...base, id: 'p', slug: 'pork-joint', origin: '국내산 (흑돼지)', certifications: [], sku: 'FT-P04', allergens: ['돼지고기', '어류(연어유)'] },
    beef: { ...base, id: 'b', slug: 'beef-premium', origin: '국내산 (한우)', certifications: [], sku: 'FT-B05', allergens: ['소고기', '어류(연어유)'] },
  }
  const rows = Object.fromEntries(label.trialNoticeRows(labels, { phone: '070-0000-0000' }))
  assert.equal(rows['내용량'], `${catalog.TRIAL_PACK_G}g × 4팩(닭·오리·흑돼지·한우 각 1팩)`)
  assert.equal(rows['내용량'], '50g × 4팩(닭·오리·흑돼지·한우 각 1팩)')
  assert.equal(rows['가격'], `${won(catalog.TRIAL_ITEM.price)}원`, '체험팩 가격이 상품표 정본이 아니다')
  assert.equal(rows['원산지'], '닭고기·오리고기: 국내산 (주원료 무항생제)\n흑돼지: 국내산 (흑돼지)\n한우: 국내산 (한우)', '레시피마다 다른 원산지를 묶어 보이지 않는다')
  assert.equal(rows['제조원'], '파머스테일 · 인천광역시 연수구 송도과학로28번길 50', '네 종이 같은 값을 한 번만 보이지 않는다')
  assert.equal(rows['유통기한'], '제조일부터 냉동 180일')
  assert.equal(rows['사료의 종류'], '배합사료(애완동물용)')
  assert.equal(rows['보관 방법'], '영하 18℃ 이하 냉동 보관.')
  assert.equal(rows['알레르기 정보'], '닭고기, 오리고기, 돼지고기, 소고기, 어류(연어유)', '알레르기 정보가 4종 합집합이 아니다')
  assert.equal(rows['상품 번호'], '닭고기 FT-C01 · 오리고기 FT-D02 · 흑돼지 FT-P04 · 한우 FT-B05')
  assert.equal(rows['인증·원료'], '닭고기: 주원료 국내산 무항생제\n오리고기: 주원료 무항생제', '인증이 있는 레시피만 적지 않는다')
  assert.equal(rows['고객센터'], '070-0000-0000')
  // 네 종 다 빈 칸은 줄을 뺀다(지어내지 않는다).
  const blank = Object.fromEntries(
    label.trialNoticeRows(
      Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, { ...v, origin: null }])) as Labels,
      { phone: '070-0000-0000' },
    ),
  )
  assert.equal(blank['원산지'], undefined, '라벨에 없는 원산지를 지어낸다')
})

test('규칙212: 매거진 — 공개 글이 0편인 카테고리는 단추를 숨기고, 글 조회가 실패하면 숨기지 않는다', async () => {
  /**
   * # 왜 (2026-10-13 토스 심사 준비)
   * 카테고리 다섯 중 셋(영양 가이드·품종별 케어·브랜드 스토리)이 0편이라 누르면 '준비 중' 빈 화면이었다.
   * 하지만 조회 실패를 0편으로 읽으면 실패 한 번에 카테고리가 전부 사라진다(AGENTS 규칙1) — 실패면 지금처럼 다 보인다.
   */
  const page = code('app', 'blog', '(index)', 'page.tsx')
  assert.ok(!/\{cats\.map\(\(c\) => \(\s*<CategoryButton/.test(page), '카테고리 단추가 전체 카테고리 목록(cats)을 그린다 — 0편 카테고리도 보인다')
  assert.match(page, /\{shownCats\.map\(\(c\) => \(\s*<CategoryButton/, '카테고리 단추가 걸러진 목록(shownCats)을 그리지 않는다')
  assert.match(page, /const shownCats = visibleMagazineCategories\(cats, postsErr \? null : allRows\)/, '매거진 목록이 글 수 판정을 쓰지 않거나 실패를 0편으로 읽는다')
  assert.ok(!/\.eq\('category_id'/.test(page), '글 수를 세는 조회가 카테고리로 걸러져 있다 — 다른 카테고리 글 수를 모른다')
  // 숨긴 카테고리 주소로 직접 오면 — 2026-10-14 부터 redirect 하지 않고 '전체' 목록을 그대로 보여 준다(규칙223 이 지킨다:
  // 로딩 화면이 먼저 나간 뒤 redirect 는 200 + 빈 화면 + meta refresh 가 됐다).
  assert.match(page, /const rows = activeCategory \? allRows\.filter\(\(p\) => p\.category_id === activeCategory\.id\) : allRows/, '숨긴 카테고리 주소가 전체 목록으로 나오지 않는다')

  const m = await load<typeof import('./magazine/categories.ts')>('lib', 'magazine', 'categories.ts')
  const cats = [
    { id: 'n', slug: 'nutrition' },
    { id: 'h', slug: 'health' },
    { id: 'g', slug: 'guide' },
  ]
  const posts = [{ category_id: 'h' }, { category_id: 'g' }, { category_id: 'g' }, { category_id: null }]
  assert.deepEqual(m.visibleMagazineCategories(cats, posts).map((c) => c.slug), ['health', 'guide'], '0편 카테고리가 보인다')
  assert.deepEqual(m.visibleMagazineCategories(cats, null).map((c) => c.slug), ['nutrition', 'health', 'guide'], '글 조회 실패를 0편으로 읽어 카테고리를 숨긴다')
  assert.deepEqual(m.visibleMagazineCategories(cats, []), [], '공개 글이 하나도 없는데 카테고리 단추가 보인다')
})

test('규칙213: /partners 는 사이트맵에서 빼고 검색에 올리지 않는다(페이지는 그대로)', () => {
  /**
   * # 왜 (2026-10-13 토스 심사 준비)
   * 공개된 농가가 0곳이라 '이런 농가와 함께하고 싶어요' 빈 상자뿐인 화면이 사이트맵·검색에 올라 있었다.
   */
  const sitemap = code('app', 'sitemap.ts')
  assert.ok(!sitemap.includes('/partners'), '사이트맵에 /partners 가 있다')
  const partners = code('app', 'partners', 'page.tsx')
  assert.match(partners, /robots: \{ index: false, follow: true \}/, '/partners 가 검색 색인 허용(index)이다')
  assert.match(partners, /export default async function PartnersPage\(/, '/partners 페이지가 없어졌다 — 페이지는 그대로 둔다')
})
