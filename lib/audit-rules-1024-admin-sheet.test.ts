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
  assert.ok(panel.includes('못 불러왔어요 — 0건이 아니에요'), "조회 실패를 '없어요'로 그린다(규칙1)")
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
