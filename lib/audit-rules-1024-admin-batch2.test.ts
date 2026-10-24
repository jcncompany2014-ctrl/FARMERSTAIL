/**
 * 2026-10-24 어드민 2묶음 — 규칙 316·317·318.
 *
 * 사장님 "그냥 전체적으로 너무 헷갈려 좀 안 헷갈리게 기획 잘해서 만들어 봐 어드민 부분" → 기획서(admin_clarity_plan) 2묶음.
 * 사장님 결정(10/24): 정기배송 배지 = '진행 중'('구독'이라는 말을 안 쓴다) · 이벤트 할인 박스 환불 시 할인 다시 안 줌(코드 그대로).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
const load = async <T>(...p: string[]): Promise<T> => (await import(pathToFileURL(join(ROOT, ...p)).href)) as T

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

test('규칙316: 어드민 상태 배지는 표 하나 — 주문은 결제됐나→환불했나→박스 위치, 정기배송은 정본 상태로 "진행 중"', async () => {
  /**
   * # 왜 (기획서 ⑥)
   * 화면마다 배지 표를 따로 만들어서 전액 환불된 주문 하나가 홈에선 '취소', 목록에선 '결제 취소', 상세에선 '환불 완료'로 나왔다.
   * 한 번도 결제 안 된 주문이 '결제 취소'로 뜨기도 했다. 정기배송은 고객용 이름표('구독 중'·'시작 전'·'결제 확인 필요')가
   * 어드민 고객 화면·한 장에 그대로 샜다.
   */
  const b = await load<typeof import('./admin/status-badge.ts')>('lib', 'admin', 'status-badge.ts')
  const o = (payment_status: string, order_status: string, paid_at: string | null) => b.orderBadge({ payment_status, order_status, paid_at })
  const PAID = '2026-10-24T00:10:00Z'
  // 결제 안 된 시도 — 점선, 이유는 작은 줄. '결제 취소'·'환불'이라고 하지 않는다(돈을 받은 적이 없다).
  assert.deepEqual(o('failed', 'pending', null), { label: '결제 안 됨', tone: 'dashed', note: '카드 거절' })
  assert.deepEqual(o('cancelled', 'cancelled', null), { label: '결제 안 됨', tone: 'dashed', note: '결제창 닫음' })
  assert.equal(o('pending', 'pending', null).note, '결제 기다리는 중')
  // 결제됐다가 전액 돌려줌 = 환불 완료(회색). 홈 '취소'·목록 '결제 취소'로 갈리던 것.
  assert.equal(o('cancelled', 'cancelled', PAID).label, '환불 완료')
  assert.equal(o('refunded', 'preparing', PAID).label, '환불 완료')
  // 결제됨 — 박스 위치. 발송 전은 사장님 할 일(주황).
  assert.deepEqual(o('paid', 'preparing', PAID), { label: '발송 전', tone: 'orange', note: undefined })
  assert.equal(o('paid', 'shipping', PAID).label, '배송 중')
  assert.equal(o('paid', 'delivered', PAID).label, '배송 완료')
  assert.deepEqual(o('partially_refunded', 'shipping', PAID), { label: '배송 중', tone: 'green', note: '부분 환불' })
  // 주문은 취소인데 돈은 결제됨으로 남음 — 돈 문제(빨강).
  assert.equal(o('paid', 'cancelled', PAID).tone, 'red')

  // 정기배송 — 사장님 결정 '진행 중'.
  assert.equal(b.SUB_BADGE.active.label, '진행 중')
  assert.equal(b.SUB_BADGE.needs_card.label, '카드 등록 전')
  assert.equal(b.SUB_BADGE.card_failed.label, '결제 실패')
  assert.equal(b.subBadgeFromStatus('active').label, b.SUB_BADGE.active.label, 'status 칸만 받는 화면의 이름이 표와 다르다')

  // 화면이 배지 표를 따로 만들지 않는다.
  const offenders: string[] = []
  for (const dir of [join(ROOT, 'app', 'admin'), join(ROOT, 'components', 'admin')]) {
    for (const f of walk(dir)) {
      const c = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
      // 주문 배지(statusBadge(paymentStatus…))·정기배송 배지 표. 링크 화면 배너의 기간 배지(진행 중·예정·끝남)는 다른 것이라 안 본다.
      if (/function statusBadge\(\s*paymentStatus/.test(c) || /const (STATUS_BADGE|SUB_LABEL)\b/.test(c) || /label: '구독 중'/.test(c)) offenders.push(f.slice(ROOT.length))
    }
  }
  assert.deepEqual(offenders, [], `배지 표를 따로 만드는 어드민 화면: ${offenders.join(', ')}`)
  for (const f of [
    ['app', 'admin', 'orders', 'page.tsx'],
    ['app', 'admin', 'orders', '[id]', 'page.tsx'],
    ['app', 'admin', 'search-all', 'page.tsx'],
  ]) {
    assert.match(code(...f), /orderBadge\(/, `${f.join('/')}: 주문 배지를 표(orderBadge)로 안 그린다`)
  }
  assert.match(code('app', 'admin', 'users', '[id]', '_data.ts'), /stateLabel: subBadge\(st\)\.label/, '고객 화면·한 장의 상태 이름이 고객용 이름표다')
  assert.ok(!code('app', 'admin', 'users', '[id]', '_data.ts').includes('SUB_STATE_LABEL'), '어드민 고객 화면이 고객용 상태 이름표(SUB_STATE_LABEL)를 쓴다')
})

test('규칙317: 강아지 이름으로 찾는다 — 찾기 화면·정기배송 목록, 강아지를 누르면 정기배송 한 장', () => {
  /**
   * # 왜
   * 사장님은 고객을 강아지 이름으로 기억한다(태리·치카). 그런데 통합 검색·회원 검색·정기배송 목록 검색 셋 다 강아지 이름으로는
   * 아무것도 못 찾았다.
   */
  const s = code('app', 'admin', 'search-all', 'page.tsx')
  assert.match(s, /from\('dogs'\)\.select\('id, name, user_id'\)\.ilike\('name', like\)/, '찾기가 강아지 이름을 안 본다')
  assert.match(s, /clauses\.push\(`dog_id\.in\.\(\$\{dogs\.map\(\(d\) => d\.id\)\.join\(','\)\}\)`\)/, '찾은 강아지의 정기배송을 안 가져온다')
  assert.match(s, /href=\{subscriptionHref\(s\.id\)\}/, '찾기의 강아지 줄이 정기배송 한 장으로 안 간다')
  assert.match(s, /if \(sRes\.error\) failed\.push\('정기배송'\)/, '정기배송 조회 실패를 결과 없음으로 감춘다(규칙1)')
  assert.match(s, /import \{ safeOrTerm \} from '@\/lib\/supabase\/or-filter'/, '찾기가 검색어 정화 정본을 안 쓴다')
  const list = code('app', 'admin', 'subscriptions', 'page.tsx')
  assert.match(list, /const dog = \(s\.dogs\?\.name \|\| ''\)\.toLowerCase\(\)/, '정기배송 목록 검색이 강아지 이름을 안 본다')
  assert.match(list, /placeholder="강아지 이름 · 보호자 · 전화"/)
  // 홈 맨 위 찾기 칸이 같은 찾기 화면으로 간다.
  assert.match(code('app', 'admin', 'page.tsx'), /<form action="\/admin\/search-all" method="get"/, '홈에 찾기 칸이 없다')
})

test('규칙318: 어드민 홈은 네 덩어리 — 찾기 → 새로 들어온 것 → 오늘 할 일(할 일·처리 대기·키 이상) → 숫자 4개, 나머지는 접힘', () => {
  /**
   * # 왜 (기획서 ③)
   * 홈이 열두 덩어리였고 같은 일이 이름만 바꿔 두세 번 나왔다(카드 재등록은 이번 주 할 일과 처리 대기에 둘 다, 재고·새 주문은
   * 세 번씩). 매일 보는 건 위 두 덩어리뿐이었다. 할 게 없는 줄과 빈 요일 칸은 숨기고, 매일 안 보는 숫자는 '숫자 더 보기'로 접는다.
   */
  const home = code('app', 'admin', 'page.tsx')
  const at = (s: string) => home.indexOf(s)
  const order = ['<form action="/admin/search-all"', '<NewArrivalsPanel', '<WeeklyTodoPanel', '<ActionsPanel', 'label="최근 2주 매출"', '숫자 더 보기']
  for (let i = 1; i < order.length; i++) {
    const prev = order[i - 1]!
    const next = order[i]!
    assert.ok(at(prev) > 0 && at(prev) < at(next), `홈 순서가 틀렸다: ${prev} 다음에 ${next}`)
  }
  assert.match(home, /<h1 className="[^"]*">홈<\/h1>/, "홈 제목이 메뉴 이름('홈')과 다르다")
  for (const label of ['진행 중 정기배송', '다음 2주 결제 예정', '최근 30일 해지']) assert.ok(home.includes(`label="${label}"`), `숫자 4개에 '${label}'이 없다`)
  assert.match(home, /<details className="rounded-xl border border-border bg-card">\s*<summary/, "매일 안 보는 숫자가 '숫자 더 보기'로 접혀 있지 않다")
  // 다음 2주 결제 예정 = 청구와 같은 함수(서포터즈·등급 할인).
  assert.match(home, /const nextTwoWeeksCharge = activeSubs\.reduce\(\(sum, s\) => sum \+ chargeOf\(s\), 0\)/)
  // 웹 가게 시험 모드는 심사 중 정상 — 위험일 때만 크게.
  assert.match(home, /return \{ \.\.\.d, quiet: d\.tone !== 'danger' \}/, '웹 가게 시험 모드가 노란 카드로 매일 뜬다')
  // 마우스 전용 '?'(폰에선 안 보임)를 버리고 공용 HelpTip(눌러서 펼침).
  assert.match(home, /import \{ HelpTip \} from '@\/components\/admin\/ui'/, "홈 '?'가 폰에서 안 펼쳐진다")

  const panel = code('components', 'admin', 'WeeklyTodoPanel.tsx')
  assert.match(panel, /return it\.count === 0 && it\.tone === 'ok' && !it\.error/, "할 게 없는 줄(0건·정상)을 숨기지 않는다 — 못 셈은 남겨야 한다")
  assert.ok(!home.includes("'대시보드'"), "홈을 '대시보드'로 부른다")
  assert.match(panel, /\.filter\(\(d\) => d\.isToday \|\| d\.items\.length > 0\)/, '빈 요일 칸을 숨기지 않는다(오늘 칸은 남긴다)')
  assert.match(panel, /open=\{day\.isToday \|\| urgent\}/, '오늘 칸·손볼 것이 있는 칸이 펼쳐지지 않는다')
})

test('규칙319: 어드민 이름표 하나 — 메뉴(세 묶음)·탭·화면 제목이 lib/admin/page-labels 를 쓰고, 옛 말이 메뉴에 없다', async () => {
  /**
   * # 왜 (기획서 ④)
   * 메뉴가 37개였고 메뉴 이름과 열리는 화면 이름이 다른 곳이 27군데쯤 있었다(메뉴 '구독' → 화면 '정기배송 관리', '처방 알고리즘' →
   * '알고리즘 계수', 'CS 인박스' → '고객 답장'). '찾기'는 맨 아래 '시스템'에 있었다.
   */
  const { ADMIN_PAGE_LABEL } = await load<typeof import('./admin/page-labels.ts')>('lib', 'admin', 'page-labels.ts')
  const shell = code('components', 'adminui', 'admin-shell-next.tsx')
  // 세 묶음 — 매일(찾기가 두 번째)·가끔·설정(접힘).
  assert.match(shell, /label: '매일',\s*items: \[\s*nav\('\/admin', Home\),\s*nav\('\/admin\/search-all', Search\),/, "메뉴 '매일' 묶음 맨 위가 홈 → 찾기가 아니다")
  assert.match(shell, /label: '설정',\s*foldable: true,/, "'설정' 묶음이 접히지 않는다")
  assert.match(shell, /const nav = \(href: AdminPageHref, icon: LucideIcon\) => \(\{ href, label: ADMIN_PAGE_LABEL\[href\], icon \}\)/, '메뉴 이름이 이름표 하나에서 오지 않는다')
  assert.ok(!/label: '[^']+', icon:/.test(shell), '메뉴에 이름을 직접 적은 줄이 있다(이름표를 거치지 않음)')
  // 메뉴에 걸린 화면은 전부 이름표에 있고, 이름표의 화면은 메뉴나 탭(배송 달력은 정기배송 탭) 어딘가에 있다.
  const tabs = code('components', 'admin', 'tabGroups.ts')
  const navHrefs = new Set([...shell.matchAll(/nav\('([^']+)'/g)].map((m) => m[1]))
  const tabHrefs = new Set([...tabs.matchAll(/href: '([^']+)'/g)].map((m) => m[1]))
  for (const h of navHrefs) assert.ok(h! in ADMIN_PAGE_LABEL, `메뉴의 ${h} 가 이름표에 없다`)
  for (const h of Object.keys(ADMIN_PAGE_LABEL)) assert.ok(navHrefs.has(h) || tabHrefs.has(h), `이름표의 ${h} 가 메뉴·탭 어디에도 없다`)
  // 탭도 같은 이름표.
  assert.ok(!/label: '/.test(tabs), '탭에 이름을 직접 적었다(이름표를 거치지 않음)')
  // 옛 말이 이름표에 없다.
  for (const old of ['구독', '체험단', 'CS', '인박스', '크론', '처방', '개인화', '퍼널', '코호트', '대시보드', '재무', '원장', '블로그', 'FAQ']) {
    for (const [href, label] of Object.entries(ADMIN_PAGE_LABEL)) assert.ok(!label.includes(old), `${href} 이름 '${label}'에 안 쓰는 말 '${old}'`)
  }
  // 화면 제목(h1·AdminHeader)이 메뉴 이름과 같다.
  const titled: Array<[keyof typeof ADMIN_PAGE_LABEL, string[]]> = [
    ['/admin/orders', ['app', 'admin', 'orders', 'page.tsx']],
    ['/admin/subscriptions', ['app', 'admin', 'subscriptions', 'page.tsx']],
    ['/admin/subscriptions/calendar', ['app', 'admin', 'subscriptions', 'calendar', 'page.tsx']],
    ['/admin/subscriptions/charges', ['app', 'admin', 'subscriptions', 'charges', 'page.tsx']],
    ['/admin/cs-inbox', ['app', 'admin', 'cs-inbox', 'page.tsx']],
    ['/admin/users', ['app', 'admin', 'users', 'page.tsx']],
    ['/admin/refunds', ['app', 'admin', 'refunds', 'page.tsx']],
    ['/admin/products', ['app', 'admin', 'products', 'page.tsx']],
    ['/admin/finance', ['app', 'admin', 'finance', 'page.tsx']],
    ['/admin/algorithm', ['app', 'admin', 'algorithm', 'page.tsx']],
    ['/admin/blog', ['app', 'admin', 'blog', 'page.tsx']],
    ['/admin/search-all', ['app', 'admin', 'search-all', 'page.tsx']],
    ['/admin/trials', ['app', 'admin', 'trials', 'page.tsx']],
    ['/admin/promotions', ['app', 'admin', 'promotions', 'page.tsx']],
    ['/admin/loyalty', ['app', 'admin', 'loyalty', 'page.tsx']],
  ]
  for (const [href, file] of titled) {
    const c = code(...file)
    const label = ADMIN_PAGE_LABEL[href]
    const h1 = c.match(/<h1[^>]*>\s*([^<{]+?)\s*<\/h1>/)?.[1]
    const header = c.match(/<AdminHeader\s+title="([^"]+)"/)?.[1]
    assert.equal(h1 ?? header, label, `${file.join('/')} 제목이 메뉴 이름 '${label}'과 다르다`)
  }
  // 브라우저 탭 제목에 '— Admin'·'| Admin' 이 없다.
  const offenders: string[] = []
  for (const f of walk(join(ROOT, 'app', 'admin'))) if (/title: '[^']*[—|] Admin'/.test(readFileSync(f, 'utf8'))) offenders.push(f.slice(ROOT.length))
  assert.deepEqual(offenders, [], `탭 제목에 영어 'Admin': ${offenders.join(', ')}`)
})

test('규칙320: 자동결제 기록 줄마다 누구·할인 이름·시험 딱지 · 주문 카드 한 줄(강아지·발송일·송장) · 주문 상세는 송장 칸이 맨 위', () => {
  /**
   * # 왜 (기획서 2-7·2-8)
   * 자동결제 기록은 실패·보류 줄에만 고객이 붙어서, 성공한 100원 줄이 누구 것인지·서포터즈인지 몰랐다.
   * 주문 목록 카드는 주문번호·받는 분 이름뿐이라 '태리 박스 송장 넣었나'를 보려면 하나씩 열어야 했다.
   * 주문 상세는 송장 칸이 '주문 상태 관리' 아래 세 번째 칸이었다(화요일에 제일 많이 하는 일).
   */
  const page = code('app', 'admin', 'subscriptions', 'charges', 'page.tsx')
  assert.match(page, /const subIds = \[\.\.\.new Set\(list\.map\(\(r\) => r\.subscription_id\)\)\]/, '누구 붙이기가 실패·보류 줄에만 한다')
  assert.match(page, /test: isInternalUser\(r\.user_id, internal\.ids\)/, '자동결제 줄에 시험 딱지가 없다')
  assert.match(page, /adminDiscountLabel\(o\.discount_reason\)/, '자동결제 줄의 할인 이름이 어드민 이름표가 아니다')
  assert.match(page, /if \(discRes\.error\) enrichError = /, '할인 조회 실패를 감춘다(규칙1)')
  const view = code('app', 'admin', 'subscriptions', 'charges', 'ChargeRowsView.tsx')
  assert.match(view, /if \(!w\) return <span className="[^"]*text-destructive">누구인지 불러오지 못했어요<\/span>/, "누구를 못 읽은 줄이 빈칸으로 보인다")
  assert.equal((view.match(/<WhoLine row=\{row\} \/>/g) ?? []).length, 2, '폰 카드·넓은 표 둘 다에 누구 줄이 있어야 한다')

  const orders = code('app', 'admin', 'orders', 'page.tsx')
  assert.match(orders, /paidBoxShipIso\(info\?\.next \?\? null, o\.paid_at\)/, '정기배송 주문 발송일을 정본(paidBoxShipIso)으로 안 낸다')
  assert.match(orders, /storeShipDate\(kstDateOf\(o\.paid_at\)\)/, '가게 주문 출고일을 정본(storeShipDate)으로 안 낸다')
  assert.match(orders, /if \(subErr\) console\.error\(/, '강아지 이름 조회 실패를 아무 데도 안 남긴다')

  const detail = code('app', 'admin', 'orders', '[id]', 'page.tsx')
  assert.ok(detail.indexOf('<ShippingControl') > 0 && detail.indexOf('<ShippingControl') < detail.indexOf('주문 상품 ('), '주문 상세 송장 칸이 맨 위가 아니다')
  const ctl = code('app', 'admin', 'orders', '[id]', 'OrderStatusControl.tsx')
  assert.match(ctl, /<details className="[^"]*">\s*<summary[^>]*>\s*주문 상태 바꾸기/, "'주문 상태 바꾸기'가 접혀 있지 않다")
  assert.ok(!ctl.includes('클릭해서 상태를 변경하세요'), '어려운 말(클릭해서 상태를 변경하세요)이 남아 있다')
})
