/**
 * 2026-10-24 규칙 314 — 정기배송 한 장 + 홈 '새로 들어온 것'.
 *
 * 사장님 "오늘 구독 주문 들어왔는데 핸드폰에 알림도 안 뜨고 어드민에서 보기도 너무너무 불편하고" · "어드민은 진짜 정보들 읽기가
 * 너무 불편해 대대적인 진화가 필요해". 새 정기배송 한 건을 보려면 목록 → 고객 화면 → 긴 스크롤(화면 3개·탭 3번)이었고, 홈에는
 * 새 정기배송 줄이 아예 없었다(토요일 첫 결제 전엔 주문 표에 줄이 없다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙314: 정기배송 한 장은 고객 화면과 같은 정본 조회를 쓰고, 관리자 확인 뒤에 읽는다', () => {
  const page = code('app', 'admin', 'subscriptions', '[id]', 'page.tsx')
  assert.match(page, /loadCustomerData\(owner\.user_id\)/, '한 장이 정본 조회(loadCustomerData)를 안 쓴다 — 돈·날짜를 따로 계산하면 화면끼리 어긋난다')
  assert.ok(page.indexOf('isAdmin(supabase, user)') < page.indexOf('createAdminClient()'), '관리자 확인 전에 service_role 로 읽는다')
  assert.match(page, /if \(error\) throw new Error/, '구독 조회 실패가 없는 구독(404)으로 보인다(규칙1)')
  const sheet = code('app', 'admin', 'subscriptions', '[id]', 'SubscriptionSheet.tsx')
  // 받는 곳 — 전화·문자 링크(어드민 전체에 0개였다)와 복사
  assert.match(sheet, /href=\{`tel:\$\{telDigits\(ship\.phone\)\}`\}/, '한 장에 전화 걸기 링크가 없다')
  assert.match(sheet, /href=\{`sms:\$\{telDigits\(ship\.phone\)\}`\}/, '한 장에 문자 링크가 없다')
  assert.match(sheet, /<CopyField\s+value=\{`\$\{ship\.address\}/, '한 장에 주소 복사가 없다')
  assert.ok(sheet.includes('sub.deliveryMemo'), '한 장에 배송 메모가 없다(포장 목록에서만 보였다)')
  // 금액은 실제로 결제될 금액을 크게(정가만 보이면 서포터즈 100원이 51,500원처럼 읽힌다)
  assert.match(sheet, /won\(sub\.chargeAmount \?\? sub\.storedAmount\)/, '한 장의 큰 금액이 실제 결제 금액이 아니다')
  const data = code('app', 'admin', 'users', '[id]', '_data.ts')
  assert.match(data, /address_detail, delivery_memo',/, '고객 조회가 배송 메모를 안 읽는다')
  assert.match(data, /deliveryMemo: s\.delivery_memo,/, '배송 메모가 화면으로 안 넘어간다')
})

test('규칙314: 새 정기배송·알림·달력·할 일·목록·고객 화면이 전부 한 장(subscriptionHref)으로 간다', () => {
  const link = code('lib', 'admin', 'customer-link.ts')
  assert.match(link, /export function subscriptionHref\(subscriptionId: string\): string \{\s*return `\/admin\/subscriptions\/\$\{encodeURIComponent\(subscriptionId\)\}`/, '정기배송 한 장 주소 정본이 없다')
  assert.match(code('lib', 'admin', 'notify-admins.ts'), /url: subscriptionHref\(i\.subscriptionId\)/, '새 정기배송 알림이 한 장을 안 연다')
  const cal = code('app', 'admin', 'subscriptions', 'calendar', 'page.tsx')
  assert.ok(!cal.includes('?focus='), '달력 칩이 목록이 읽지도 않는 ?focus= 로 간다(헛걸음)')
  assert.equal((cal.match(/href=\{subscriptionHref\(it\.id\)\}/g) ?? []).length, 2, '달력 칩 두 곳이 한 장으로 안 간다')
  assert.match(code('lib', 'admin', 'weekly-todo.ts'), /const subHref = \(subId: string\) => subscriptionHref\(subId\)/, '이번 주 할 일 이름 줄이 한 장으로 안 간다')
  const list = code('app', 'admin', 'subscriptions', 'page.tsx')
  assert.equal((list.match(/<Link href=\{subscriptionHref\(sub\.id\)\}/g) ?? []).length, 2, '정기배송 목록(폰 카드·PC 줄)이 한 장으로 안 간다')
  assert.match(list, /dogs\(id, name, weight\)/, '정기배송 목록이 몸무게를 안 읽는다')
  assert.ok(!list.includes('📦'), '탭 이름에 이모지가 남았다')
  assert.match(code('app', 'admin', 'users', '[id]', 'CustomerView.tsx'), /href=\{subscriptionHref\(sub\.id\)\}/, '고객 화면 정기배송 카드에서 한 장으로 가는 길이 없다')
})

test('규칙314: 홈 맨 위 새로 들어온 것 — 첫 카드 등록 판정·실제 금액·시험 계정 제외·못 봄 표시', () => {
  const lib = code('lib', 'admin', 'new-arrivals.ts')
  assert.match(lib, /\.eq\('kind', 'card'\)/, '새 정기배송을 카드 등록 기록으로 안 가른다')
  assert.match(lib, /if \(!afterDate \|\| !e\.before \|\| !\('next_delivery_date' in e\.before\)\) continue/, '일정이 안 생긴 카드 교체까지 새 정기배송으로 센다')
  assert.match(lib, /reRegistered: e\.before\.next_delivery_date != null/, '결제 실패 뒤 카드 재등록을 새 고객으로 센다')
  assert.match(lib, /resolveAutoDiscount\(\{ userId: r\.user_id, subtotal: r\.total_amount \?\? 0, subscriptionId: r\.id \}\)/, '새 정기배송 금액이 실제 결제 금액(정본)이 아니다')
  assert.match(lib, /cycleChargeResults\(rows\)/, '결제 실패를 마지막 시도로 판정하지 않는다(다음 날 성공한 것까지 실패로 남는다)')
  assert.match(lib, /classifyCancellation\(s, liveDogIds\) === 'real'/, '해지에 카드 등록 전 포기·재구독이 섞인다')
  assert.ok((lib.match(/notTest\(/g) ?? []).length >= 4, '새로 들어온 것에 시험 계정이 섞인다')
  const panel = code('components', 'admin', 'NewArrivalsPanel.tsx')
  assert.match(panel, /href=\{subscriptionHref\(s\.subscriptionId\)\}/, '새 정기배송 줄이 한 장을 안 연다')
  assert.ok(panel.includes('불러오지 못했어요 — 없는 게 아니에요'), "조회 실패를 '없어요'로 그린다(규칙1)")
  const home = code('app', 'admin', 'page.tsx')
  assert.ok(home.indexOf('<NewArrivalsPanel') > 0 && home.indexOf('<NewArrivalsPanel') < home.indexOf('<WeeklyTodoPanel'), "'새로 들어온 것'이 홈 맨 위(이번 주 할 일 위)에 없다")
})

test('규칙314: 포장 목록 이름 하나·영어 배지 없음 · 점검 화면이 있다', () => {
  const pick = code('app', 'admin', 'personalization', 'picking-list', 'page.tsx')
  assert.ok(!pick.includes('박스 패킹 —'), "포장 목록 제목이 '박스 패킹'(이름 세 벌)으로 남았다")
  assert.ok(!/>cycle \{/.test(pick), "포장 목록에 영어 'cycle n' 배지가 남았다")
  assert.ok(!pick.includes('px-5 py-6'), '포장 목록에 셸 여백과 겹치는 이중 여백이 남았다')
  assert.match(code('components', 'adminui', 'admin-shell-next.tsx'), /label: '포장 목록'/, "메뉴 이름이 '포장 목록'이 아니다")
  assert.ok(existsSync(join(ROOT, 'app', 'design-check-admin', 'subscription', 'page.tsx')), '정기배송 한 장 점검 화면이 없다')
  assert.ok(existsSync(join(ROOT, 'app', 'design-check-admin', 'arrivals', 'page.tsx')), '새로 들어온 것 점검 화면이 없다')
})

test('규칙314 보강: 금액 말 정리 — 한 장·고객 화면·새로 들어온 것이 이미 낸 금액(주문 표)과 다음 결제(날짜)를 나눠 보인다', () => {
  /**
   * 2026-10-24 사장님 "실결제 내역이랑 주문 내역 가격이 달라. 할인 가격은 할인 가격으로 떠야지. 전체적으로 너무 헷갈려".
   * 잘못 나간 돈은 없었다 — 한 장 맨 위 띠는 '10/27 발송'인데 바로 밑 금액 칸에 11/7 결제분 정가(128,500원)가 '이번' 금액으로
   * 떠서 이미 낸 78,500원이 안 보였고, 홈 '새로 들어온 것'은 결제가 끝나자 첫 박스 대신 다음 회차를 보였다.
   * 돈 말은 넷만: 결제한 금액(줄 안에선 '결제함') · 다음 결제(날짜와 함께) · 정가 · '할인 이름 −금액'. 값은 정본만(새 계산 금지).
   */
  const data = code('app', 'admin', 'users', '[id]', '_data.ts')
  assert.match(
    data,
    /select\('id, subscription_id, order_number, total_amount, subtotal, discount_amount, discount_reason, paid_at, created_at'\)/,
    '결제된 박스 조회가 결제한 금액·정가·할인을 안 읽는다',
  )
  assert.match(data, /amount: pb\.total_amount,/, '이번 박스 결제한 금액이 주문의 결제 금액(orders.total_amount)이 아니다')
  assert.match(data, /list: pb\.subtotal \?\? pb\.total_amount,/, '이번 박스 정가가 주문의 정가(orders.subtotal)가 아니다')
  assert.match(data, /shipIso: paidBoxShipIso\(s\.next_delivery_date, pbPaidAt\)/, '이번 박스 발송일이 정본(paidBoxShipIso)이 아니다')
  assert.match(
    data,
    /nextChargeIso: st === 'active' && timing && s\.next_delivery_date \? chargeDateFor\(s\.next_delivery_date, timing\) : null/,
    '다음 결제일이 정본(chargeDateFor + 결제 시점)이 아니거나, 진행 중이 아닌데(일시정지·카드 문제) 날짜를 단정한다',
  )
  assert.match(data, /hasPaidPreparingOrder: !!pb,\s*paidAt: pbPaidAt,/, "띠('이번 박스' 판정)와 금액 칸이 다른 결제된 박스를 본다")

  const sheet = code('app', 'admin', 'subscriptions', '[id]', 'SubscriptionSheet.tsx')
  for (const old of ['이번에 결제될 금액', '받은 박스', "'2주 금액'", '이번 결제 금액']) {
    assert.ok(!sheet.includes(old), `한 장에 옛 금액 말 '${old}'이 남았다`)
  }
  assert.match(sheet, /<Block title=\{`이번 박스 · \$\{md\(pb\.shipIso\)\} 발송`\}>\s*<PaidBoxCard pb=\{pb\} \/>/, "한 장에 '이번 박스(이미 결제함)' 칸이 없다")
  const card = sheet.slice(sheet.indexOf('function PaidBoxCard('), sheet.indexOf('function nextChargeTitle('))
  assert.match(card, /won\(pb\.amount\)/, '이번 박스 큰 금액이 결제한 금액이 아니다')
  assert.match(card, /adminDiscountLabel\(pb\.discountReason\)\} −\{won\(pb\.discountAmount\)\}/, "할인이 '할인 이름 −금액'이 아니다")
  assert.match(card, /href=\{`\/admin\/orders\/\$\{encodeURIComponent\(pb\.orderId\)\}`\}/, '이번 박스에서 주문으로 가는 길이 없다')
  assert.match(sheet, /\{e\.paid_box \? \(\s*<Block title="이번 박스">\s*<LoadError/, "결제된 박스 조회 실패를 '결제 전'으로 그린다(규칙1)")
  assert.match(sheet, /e\.subs \|\| e\.trial \|\| e\.paid_box \?/, '결제된 박스를 못 읽었는데 띠가 다음 회차를 이번 박스처럼 말한다')
  const title = sheet.slice(sheet.indexOf('function nextChargeTitle('), sheet.indexOf('export default function SubscriptionSheet('))
  assert.match(title, /return '정가\(2주\)'/, "해지·카드 등록 전 금액 이름이 '정가(2주)'가 아니다")
  assert.match(title, /`다음 결제 · \$\{md\(sub\.nextChargeIso\)\} 아침`/, '다음 결제에 날짜가 없다')
  assert.match(sheet, /은 첫 박스만이라 다음부터 정가예요/, "첫 박스 할인이 끝나 정가로 돌아갈 때 '왜 올랐지'를 막는 한 줄이 없다")
  assert.match(sheet, /`결제된 박스 \$\{sub\.totalDeliveries\}회`/, "'받은 박스'가 '결제된 박스'로 안 바뀌었다(결제할 때 오르는 숫자다)")

  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  for (const old of ['저장 금액', '다음 결제 실제 금액', '"받은 박스"', '결제 예정 금액', '결제됨(포장 대기)']) {
    assert.ok(!view.includes(old), `고객 화면에 옛 말 '${old}'이 남았다`)
  }
  assert.match(view, /<Row label="정가\(2주\)">\{won\(sub\.storedAmount\)\}<\/Row>/, "고객 화면 정기배송 카드에 '정가(2주)'가 없다")
  assert.match(view, /`다음 결제 · \$\{dayLabel\(sub\.nextChargeIso\)\}/, '고객 화면 다음 결제에 날짜가 없다')
  assert.match(view, /결제함 \{won\(pb\.amount\)\}/, "고객 화면에 '이번 박스 결제함' 줄이 없다")
  assert.match(view, /<Row label="결제된 박스">/, "고객 화면 '받은 박스'가 '결제된 박스'로 안 바뀌었다")

  const lib = code('lib', 'admin', 'new-arrivals.ts')
  assert.match(
    lib,
    /\.in\('subscription_id', ids\)\s*\.in\('payment_status', \[\.\.\.PAID_STATUSES\]\)\s*\.not\('paid_at', 'is', null\)\s*\.order\('paid_at', \{ ascending: true \}\)/,
    '첫 결제를 구독의 결제된 주문 중 가장 이른 것으로 고르지 않는다',
  )
  assert.match(lib, /if \(paidErr\) failures\.push\(/, '첫 결제 조회 실패를 알리지 않는다(규칙1)')
  assert.match(lib, /paidUnknown: !!paidErr,/, "첫 결제 조회 실패를 '결제 전'으로 그린다(규칙1)")
  assert.match(lib, /amount: fp\.total_amount,/, '첫 결제 금액이 주문의 결제 금액이 아니다')
  assert.match(lib, /shipIso: paidBoxShipIso\(r\.next_delivery_date, fp\.paid_at\)/, '첫 박스 발송일이 정본(paidBoxShipIso)이 아니다')
  const panel = code('components', 'admin', 'NewArrivalsPanel.tsx')
  assert.match(
    panel,
    /\{fp \? `결제함 \$\{won\(fp\.amount\)\}` : `다음 결제 \$\{won\(s\.chargeAmount \?\? s\.storedAmount\)\}`\} ›/,
    "새 정기배송 금액 자리가 '결제함 ○원'(결제됨) / '다음 결제 ○원'(결제 전)으로 나뉘지 않는다",
  )
  assert.match(panel, /`\$\{md\(kstDateOf\(fp\.paidAt\)\)\} 결제함 → \$\{md\(fp\.shipIso\)\} 발송`/, "결제된 첫 박스의 '결제일 결제함 → 발송일 발송' 줄이 없다(결제일은 KST)")
  assert.match(panel, /\{fp && <p className="[^"]*text-muted-foreground">\{nextChargeText\(s\)\}<\/p>\}/, '결제된 뒤 다음 결제가 회색 줄로 안 보인다')
  assert.match(panel, /!fp && s\.paidUnknown && \(/, "첫 결제 조회 실패를 '결제 전'으로 그린다(규칙1)")
  assert.ok(panel.includes('카드 바꿔서 다시 이어짐') && !panel.includes('카드를 다시 등록한 구독'), "'카드를 다시 등록한 구독'이 '카드 바꿔서 다시 이어짐'으로 안 바뀌었다")
  assert.ok(!/text-\[(9|10|11)(\.5)?px\]/.test(panel), '새로 들어온 것에 12px 미만 글씨가 있다')

  // 예시 화면도 새 모양(결제된 첫 박스·이번 박스가 실제로 그려지는지 사람이 본다).
  assert.match(code('app', 'design-check-admin', 'arrivals', 'page.tsx'), /firstPaid: \{\s*orderId:/, '새로 들어온 것 점검 화면에 결제된 첫 박스 예시가 없다')
  assert.match(code('app', 'design-check-admin', 'customer', '_fixtures.ts'), /paidBox: \{\s*orderId:/, '한 장·고객 화면 점검에 이번 박스(결제함) 예시가 없다')
})
