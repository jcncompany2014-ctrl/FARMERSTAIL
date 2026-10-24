/**
 * 2026-10-24 규칙 313 — 어드민 목록에서 시험 계정·결제 안 된 시도를 진짜 주문과 섞지 않는다.
 *
 * 사장님: "푸린네 저거 가짜계정인데 계속 주문 화면에 뜨고 서포터즈도 주문 취소된 건이 같이 잡혀서 헷갈리고 내 계정 푸린이
 * 구독도 일부러 미루기해 놨는데 왜 뜨는지 모르겠고" · "제일 인기 있던 메뉴? 그런 거에도 가격이 정가로 나와 있어서 헷갈려
 * … 어차피 다 맞춤이라 다 다른데".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙313: 푸린네(가짜 계정)는 내부 계정 명시 목록에 있다', () => {
  const lib = code('lib', 'admin', 'internal-accounts.ts')
  assert.match(lib, /INTERNAL_ACCOUNT_IDS: readonly string\[\] = \[[^\]]*'4cc34360-5b93-4f6a-825c-85c2ca9529a6'/, '푸린네가 내부 계정 목록에서 빠졌다')
})

test('규칙313: 주문 목록 — 시험 계정은 기본 숨김, 전체는 결제된 주문만, 결제 안 된 시도는 따로', () => {
  const page = code('app', 'admin', 'orders', 'page.tsx')
  // 기본 숨김 — ?test=1 일 때만 보인다
  assert.match(page, /const showTest = testRaw === '1'/, '주문 목록의 시험 계정 보기 스위치가 없다')
  assert.match(page, /const hideFilter = showTest \? null : excludeInternalFilter\(internal\.ids\)/, '주문 목록이 시험 계정을 기본으로 숨기지 않는다')
  assert.match(page, /if \(hideFilter\) query = query\.or\(hideFilter\)/, '숨김 필터가 목록 쿼리에 안 걸린다')
  // 전체 = 결제된 적 있는 주문, 결제 안 된 시도 = paid_at 없음
  assert.match(page, /if \(status === 'unpaid'\) \{\s*x = x\.is\('paid_at', null\)/, "'결제 안 된 시도' 칩이 paid_at 없음으로 거르지 않는다")
  assert.match(page, /x = x\.not\('paid_at', 'is', null\)/, "'전체'에 결제 안 된 시도(만료·카드 거절 회차)가 섞인다")
  assert.match(page, /key: 'unpaid', label: '결제 안 된 주문'/, "'결제 안 된 주문' 칩이 없다")
  // 옛 주소(status=pending)는 새 칩으로
  assert.match(page, /statusRaw === 'pending' \? 'unpaid' : statusRaw/, '옛 결제 전 주소가 새 칩으로 안 이어진다')
  // 보일 땐 딱지, 숨겼으면 몇 건인지
  assert.ok(page.includes('isInternalUser(o.user_id, internal.ids) && <TestBadge />'), '시험 계정 주문에 딱지가 없다')
  assert.ok(page.includes('주문 {hiddenCount}건은 안 보이게 했어요'), '숨긴 시험 계정 건수를 안 알린다')
  // 판정은 service_role 이라 페이지에서도 관리자 확인
  assert.ok(page.indexOf('isAdmin(supabase, user)') < page.indexOf('loadInternalUserIds(createAdminClient())'), '관리자 확인 전에 service_role 조회를 한다')
})

test('규칙313: 정기배송 목록 — 시험 계정 구독은 기본 숨김(숫자에서도), 보기 스위치', () => {
  const page = code('app', 'admin', 'subscriptions', 'page.tsx')
  assert.match(page, /fetch\('\/api\/admin\/internal-accounts'\)/, '정기배송 목록이 내부 계정 정본을 안 받는다')
  assert.match(page, /const visible = showTest \? subs : subs\.filter\(\(s\) => !isTestSub\(s\)\)/, '정기배송 목록이 시험 계정을 기본으로 숨기지 않는다')
  assert.match(page, /const filtered = visible\.filter\(/, '탭 목록이 숨긴 묶음이 아니라 전체로 걸러진다')
  assert.match(page, /const upcomingCount = visible\.filter\(isUpcoming\)\.length/, '배송 예정 숫자에 시험 계정이 섞인다')
  assert.ok(page.includes('isTest={isTestSub(sub)}'), '시험 계정 구독에 딱지가 없다')
  const api = code('app', 'api', 'admin', 'internal-accounts', 'route.ts')
  assert.match(api, /isAdmin\(supabase, user\)/, '내부 계정 API 에 관리자 확인이 없다')
})

test('규칙313: 홈에 결제 안 된 시도가 섞인 주문 목록이 없다 · 정가 기준 상품 순위는 없다', () => {
  const home = code('app', 'admin', 'page.tsx')
  // 2026-10-24 2묶음: 홈 '최근 들어온 주문 10건'은 뺐다(새 가게 주문은 '새로 들어온 것', 전체는 주문 화면 — 진짜 주문만).
  //   다시 생기면 진짜 주문(paid_at)·시험 계정 제외 기준을 지키는지 보고 여기를 되돌린다.
  assert.ok(!home.includes('recentOrdersRes'), '홈에 최근 주문 목록이 다시 생겼다 — 진짜 주문만(paid_at)·시험 계정 제외 기준을 확인하라')
  assert.ok(!/function statusBadge\(/.test(home), '홈이 주문 배지를 따로 만든다(배지 표는 lib/admin/status-badge 하나 — 규칙316)')
  assert.ok(!home.includes('많이 나간 상품'), '홈에 정가 기준 상품 순위가 다시 생겼다(맞춤 박스라 뜻이 없다)')
  assert.ok(!home.includes('topProducts'), '홈에 상품 순위 집계가 남아 있다')
  const reports = code('app', 'admin', 'reports', 'page.tsx')
  assert.ok(!reports.includes('topProducts'), '월 리포트에 정가 기준 상품 순위가 다시 생겼다')
})

test('규칙313: 달력은 시험 박스를 빼지 않고 표시만 한다(조리·발주 계획)', () => {
  const cal = code('app', 'admin', 'subscriptions', 'calendar', 'page.tsx')
  assert.equal((cal.match(/isInternalUser\(it\.user_id, internal\.ids\)/g) ?? []).length, 2, '달력의 시험 표시가 칸·그날 목록 둘 다에 있지 않다')
  assert.ok(!/excludeInternalFilter/.test(cal), '달력이 시험 박스를 뺀다 — 조리·발주 숫자가 실제보다 적어진다')
})
