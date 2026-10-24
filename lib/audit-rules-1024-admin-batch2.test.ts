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
  assert.match(panel, /\.filter\(\(d\) => d\.isToday \|\| d\.items\.length > 0\)/, '빈 요일 칸을 숨기지 않는다(오늘 칸은 남긴다)')
  assert.match(panel, /open=\{day\.isToday \|\| urgent\}/, '오늘 칸·손볼 것이 있는 칸이 펼쳐지지 않는다')
})
