/**
 * 2026-10-14 어드민 강화 갈래 C '고객 한 명 화면' 의 규칙 253~258 (가지 feat/admin-c-customer).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 만든 것을 테스트로 박는다. 각 규칙은 만들기 전 코드(32d1ea8c)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<32d1ea8c 를 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 *   253 C1 고객 화면 — 한 화면에 모으되 판정은 정본 함수(상태·발송일·실제 금액·서포터즈·식단·박스·알레르기·배송지)를
 *          부른다 · 칸마다 조회 실패를 따로 · 검색·구독 목록·주문 상세·포장 목록·회원 목록의 고객 이름이 이리로 온다
 *   254 C2 문의 기록 표(admin_customer_notes) — 고객 쓰기 없음·관리자 읽기·'다시 볼 날'·처리 여부 칸, 서버 라우트만 쓴다
 *   255 C3 정기배송 변경 기록(subscription_events) — 로그인 쓰기는 트리거(실패 삼킴), 서버 쓰기는 코드가 남긴다(빠짐 없이)
 *   256 C4 챙길 손님 — 메일 반송·알림 못 받음·옛 안드 1.0.10·카드 재등록(상태 정본), 고객 화면 맨 위 + 회원 목록 필터
 *   257 C5 배송지 고치기 — 기본 배송지(정본 1순위)·전화 정본·주소검색 정본·확인창·작업 기록, 금액·비율은 절대 안 쓴다
 *   258 C5 알레르기 고치기 — 설문 덮어쓰기 금지(관리자 수정 새 행)·박스 계산이 그 행을 읽는다·제안은 재제안 크론 경로로만
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

function rel(p: string): string {
  return relative(ROOT, p).split(sep).join('/')
}

function migration(name: string): string {
  const dir = join(ROOT, 'supabase', 'migrations')
  const f = readdirSync(dir).find((n) => n === name)
  assert.ok(f, `마이그레이션 파일이 없다: ${name}`)
  return readFileSync(join(dir, f!), 'utf8').replace(/\r\n/g, '\n')
}

/** SQL 의 `--` 줄 주석을 걷어낸다(설명 속 단어가 검사에 걸리지 않게). */
function sqlCode(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────

test('규칙253: 고객 한 명 화면 — 판정은 정본 함수, 칸마다 실패 표시, 다섯 곳의 고객 이름이 이 화면으로 온다 (C1)', async () => {
  /**
   * # 왜 (2026-10-14 어드민 강화 C1)
   * /admin/users/[id] 아래엔 1:1 메시지뿐이었다. 한 고객을 보려면 화면 다섯 개를 맞춰 봐야 했고 알레르기·기저질환은 어드민
   * 어디에도 안 보였다. 같은 판정을 이 화면이 다시 짜면 두 화면이 다른 말을 한다(과거 실제 사고) — 정본을 부른다.
   */
  const page = code('app', 'admin', 'users', '[id]', 'page.tsx')
  assert.match(page, /isAdmin\(supabase, user\)/, '고객 화면이 관리자를 다시 확인하지 않는다(service_role 로 읽는 화면)')
  assert.match(page, /loadCustomerData\(id\)[\s\S]{0,120}<CustomerView data=\{data\} \/>/, '고객 화면이 조회(_data)와 그리기(CustomerView)를 쓰지 않는다')

  const data = code('app', 'admin', 'users', '[id]', '_data.ts')
  for (const fn of [
    'subscriptionState(',
    'describeUpcomingBox(',
    'chargeTimingFor(',
    'resolveAutoDiscount(',
    'supporterViews(',
    'servingFormulaByDog(',
    'computeBoxPlan(',
    'subscribableItems(',
    'blockedLinesByDogFromSurveys(',
    'latestSurveyByDog(',
    'allergiesFromSurvey(',
    'chronicFromSurvey(',
    'pickShippingTarget(',
    'loadCustomerFlags(',
  ]) {
    assert.ok(data.includes(fn), `고객 화면 조회가 정본 ${fn.slice(0, -1)} 를 부르지 않는다 — 판정을 다시 짜면 두 화면이 갈린다`)
  }
  assert.match(data, /resolveAutoDiscount\(\{ userId, subtotal: s\.total_amount \?\? 0, subscriptionId: s\.id \}\)/, '실제 나갈 금액을 구독 id 없이 계산한다(여러 구독 순서 규칙이 빠진다)')
  assert.ok(!/order\('cycle_number'/.test(data), '처방을 회차 번호로 고른다(AGENTS 규칙6 — created_at)')
  assert.ok(!/\.status === 'active' \?/.test(data.replace(/s\.status === 'active' \? timing : null/, '')), '상태를 status 칸으로 직접 판정한다(정본 subscriptionState)')
  // 범위 — 전부 그 고객으로 묶는다(service_role).
  const scoped = (data.match(/\.eq\('user_id', userId\)/g) ?? []).length
  assert.ok(scoped >= 18, `고객 범위(.eq('user_id', userId))로 묶인 조회가 너무 적다: ${scoped}`)
  assert.match(data, /\.eq\('id', userId\)/, '프로필을 고객 id 로 읽지 않는다')
  // 칸마다 실패.
  for (const k of ['account', 'dogs', 'subs', 'trial', 'orders', 'charges', 'refunds', 'events', 'notes', 'memo', 'messages', 'address', 'surveys', 'box', 'proposals']) {
    assert.ok(new RegExp(`fail\\('${k}', `).test(data), `칸 '${k}' 의 조회 실패를 담지 않는다(규칙1 — 실패를 '없음'으로 그린다)`)
  }
  assert.match(data, /if \(profRes\.error\) throw new Error/, '프로필 조회 실패를 404 로 감춘다')
  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  assert.match(view, /function SectionError[\s\S]{0,300}<LoadError/, '칸 실패를 LoadError 로 그리지 않는다')
  for (const k of ["'subs'", "'events'", "'orders'", "'charges'", "'address'", "'messages'", "'surveys'"]) {
    assert.ok(view.includes(k), `화면이 칸 ${k} 의 실패를 보이지 않는다`)
  }
  // 알레르기·기저질환이 보인다(최신 설문 정본).
  assert.match(view, /<AllergyChips list=\{s\.allergies\} \/>/, '고객 화면에 알레르기가 안 보인다')
  assert.match(view, /s\.chronic\.join\(', '\)/, '고객 화면에 기저질환이 안 보인다')

  // 다섯 곳 → 고객 화면.
  const link = await load<typeof import('./admin/customer-link.ts')>('lib', 'admin', 'customer-link.ts')
  assert.equal(link.customerHref('abc'), '/admin/users/abc')
  assert.equal(link.customerHrefBySubscription('s1'), '/admin/users/by-subscription/s1')
  const search = code('app', 'admin', 'search-all', 'page.tsx')
  assert.ok(search.includes('href={customerHref(p.id)}'), '통합 검색의 회원이 고객 화면으로 안 간다')
  assert.ok(search.includes('href={customerHref(s.user_id)}'), '통합 검색의 정기배송이 고객 화면으로 안 간다')
  const subs = code('app', 'admin', 'subscriptions', 'page.tsx')
  assert.equal((subs.match(/href=\{customerHref\(sub\.user_id\)\}/g) ?? []).length, 2, '구독 목록(표·카드)의 고객 이름이 고객 화면으로 안 간다')
  assert.ok(code('app', 'admin', 'orders', '[id]', 'page.tsx').includes('href={customerHref(order.user_id)}'), '주문 상세의 주문자가 고객 화면으로 안 간다')
  assert.ok(code('app', 'admin', 'users', 'page.tsx').includes('href={customerHref(u.id)}'), '회원 목록의 이름이 고객 화면으로 안 간다')
  assert.ok(
    code('app', 'admin', 'personalization', 'picking-list', 'page.tsx').includes('href={`/admin/users/by-subscription/${r.subId}`}'),
    '포장 목록 카드의 이름이 고객 화면으로 안 간다',
  )
  const bySub = code('app', 'admin', 'users', 'by-subscription', '[subId]', 'page.tsx')
  assert.match(bySub, /isAdmin\(supabase, user\)[\s\S]*if \(error\) throw[\s\S]*redirect\(customerHref\(data\.user_id\)\)/, '구독 id 길이 관리자 확인·실패 표시·고객 화면 이동을 하지 않는다')
})

test('규칙254: 문의 기록 표 — 고객 쓰기 없음·관리자 읽기·다시 볼 날·처리 여부, 쓰기는 관리자 확인 뒤 서버만 (C2)', () => {
  /**
   * # 왜 (C2)
   * 문의는 카톡 채널로 와서 어드민에 흔적이 0이었다. admin_user_notes(한 칸)는 그대로 두고 시간순 표를 새로 만든다.
   * 어드민 홈 할 일(B 갈래)이 follow_up_on <= 오늘 and not done 을 읽는다 — 칸 이름이 바뀌면 할 일이 조용히 빈다.
   */
  const sql = migration('20261014220000_admin_customer_notes.sql')
  const s = sqlCode(sql)
  assert.match(s, /create table if not exists public\.admin_customer_notes \(/)
  assert.match(s, /user_id uuid not null references auth\.users\(id\) on delete cascade/)
  assert.match(s, /follow_up_on date,/, "'다시 볼 날' 칸(follow_up_on date)이 없다")
  assert.match(s, /done boolean not null default false/, "'처리 여부' 칸(done)이 없다")
  assert.match(s, /alter table public\.admin_customer_notes enable row level security/)
  assert.match(s, /revoke all on table public\.admin_customer_notes from anon, authenticated;/)
  assert.match(s, /for select to authenticated\s*using \(public\.is_admin\(\)\)/, '관리자 읽기 정책이 없다')
  assert.ok(!/for (insert|update|delete|all) to authenticated/.test(s), '고객(authenticated) 쓰기 정책이 있다')
  assert.match(s, /has_table_privilege\('authenticated', 'public\.admin_customer_notes', 'insert'\)/, '자기 검증 블록이 없다')
  assert.match(s, /where not done and follow_up_on is not null/, '할 일 조회용 인덱스가 없다')

  const types = read('lib', 'supabase', 'types.ts')
  const t = types.slice(types.indexOf('admin_customer_notes: {'), types.indexOf('admin_user_notes: {'))
  assert.ok(t.includes('follow_up_on: string | null') && t.includes('done: boolean'), 'types.ts 에 admin_customer_notes 가 없다')

  const route = code('app', 'api', 'admin', 'users', '[id]', 'notes', 'route.ts')
  for (const m of ['POST', 'PATCH', 'DELETE']) {
    const at = route.indexOf(`export async function ${m}(`)
    assert.ok(at > 0, `notes 라우트에 ${m} 이 없다`)
    const body = route.slice(at, route.indexOf('\nexport async function', at + 10) > 0 ? route.indexOf('\nexport async function', at + 10) : undefined)
    const gateAt = body.indexOf('await requireAdminUser()')
    const adminAt = body.indexOf('createAdminClient()')
    assert.ok(gateAt > 0 && adminAt > gateAt, `${m}: 관리자 확인 전에 service_role 을 만든다`)
    if (m !== 'POST') {
      assert.match(body, /\.eq\('user_id', id\)/, `${m}: 다른 고객의 기록을 고칠 수 있다(경로 고객으로 묶지 않음)`)
      assert.match(body, /if \(!data \|\| data\.length === 0\)[\s\S]{0,120}NOT_FOUND/, `${m}: 0행을 성공으로 말한다(규칙1)`)
    }
  }
  // 옛 한 칸 메모는 그대로 — 고객 화면이 둘 다 쓴다.
  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  assert.ok(view.includes('<AdminNoteCard userId={data.userId} initial={data.memo} />') && view.includes('<NotesPanel'), '고객 화면에 운영 메모·문의 기록이 없다')
  const guard = code('app', 'api', 'admin', 'users', '_guard.ts')
  assert.match(guard, /supabase\.auth\.getUser\(\)[\s\S]*isAdmin\(supabase, user\)/, '관문이 기존 라우트와 같은 판정(getUser + isAdmin)이 아니다')
})

test('규칙255: 정기배송 변경 기록 — 로그인 쓰기는 트리거(실패 삼킴·빌링키 없음), 서버 쓰기는 코드가 남긴다(빠짐 없이) (C3)', async () => {
  /**
   * # 왜 (C3)
   * 고객이 직접 한 건너뛰기·일시정지·재개·해지·비율·카드 변경이 DB 에 남지 않았다(GA4·메타 픽셀에만). 고객 화면 코드는 브라우저에서
   * 바로 UPDATE 하므로 트리거여야 빠짐없이 잡히고, 서버(service_role) 쓰기는 uid 가 없어 트리거가 못 보므로 코드가 남긴다.
   */
  const sql = migration('20261014220100_subscription_events.sql')
  const s = sqlCode(sql)
  assert.match(s, /create table if not exists public\.subscription_events \(/)
  assert.match(s, /revoke all on table public\.subscription_events from anon, authenticated;/)
  assert.match(s, /for select to authenticated\s*using \(public\.is_admin\(\)\)/)
  const fnAt = s.indexOf('create or replace function public.log_subscription_login_change()')
  assert.ok(fnAt > 0, '로그인 쓰기 기록 트리거 함수가 없다')
  const fn = s.slice(fnAt, s.indexOf('$$;', fnAt))
  assert.match(fn, /security definer\s*set search_path = public, pg_temp/, '트리거 함수가 SECURITY DEFINER·search_path 고정이 아니다')
  assert.match(fn, /if v_uid is null then\s*return null;/, '서버·크론 쓰기(uid 없음)를 거르지 않는다 — 청구 크론마다 기록이 쌓인다')
  assert.match(fn, /exception when others then\s*raise warning/, '기록 실패를 삼키지 않는다 — 고객의 건너뛰기·해지가 막힐 수 있다')
  assert.ok(!/'billing_key'/.test(fn) && !/new\.billing_key\s*\)/.test(fn), '트리거가 빌링키 값을 남길 수 있다')
  assert.match(s, /after insert or update on public\.subscriptions\s*for each row execute function public\.log_subscription_login_change\(\)/)
  assert.match(s, /when v_days = 14 then 'skip'/, '건너뛰기(14일)를 가르지 않는다')
  assert.match(s, /revoke all on function public\.log_subscription_login_change\(\) from public, anon, authenticated;/)

  // 종류 이름 — DB check 와 코드 정본이 같다.
  const ev = await load<typeof import('./subscription-events.ts')>('lib', 'subscription-events.ts')
  const check = /kind text not null check \(kind in \(([\s\S]*?)\)\)/.exec(s)?.[1] ?? ''
  const sqlKinds = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(sqlKinds, [...ev.SUBSCRIPTION_EVENT_KINDS].sort(), '변경 종류가 DB 와 코드에서 다르다')
  const actorCheck = /actor text not null check \(actor in \(([^)]*)\)\)/.exec(s)?.[1] ?? ''
  assert.deepEqual([...actorCheck.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(), [...ev.SUBSCRIPTION_EVENT_ACTORS].sort())
  assert.equal(ev.describeSubscriptionEvent({ kind: 'skip', before: { next_delivery_date: '2026-10-20' }, after: { next_delivery_date: '2026-11-03' } }), '발송 10/20 → 11/3')
  assert.equal(ev.describeSubscriptionEvent({ kind: 'card', before: { status: 'active' }, after: { status: 'active', card_last4: '1234' } }), '구독 중 · 카드 끝 1234')
  assert.equal(ev.describeSubscriptionEvent({ kind: 'fresh_ratio', before: { fresh_ratio: 30, total_amount: 85700 }, after: { fresh_ratio: 50, total_amount: 120300 } }), '화식 30% → 50% · 2주 85,700원 → 120,300원')

  // 서버 헬퍼 — 실패를 던지지 않는다.
  const rec = code('lib', 'subscription-events-record.ts')
  assert.match(rec, /try \{[\s\S]*const \{ error \} = await admin\.from\('subscription_events'\)\.insert\([\s\S]*if \(error\) \{[\s\S]*captureBusinessEvent[\s\S]*\} catch \(e\) \{/, '기록 헬퍼가 실패(오류·예외)를 삼키지 않는다')
  assert.ok(!/\bthrow\b/.test(rec), '기록 헬퍼가 던진다 — 고객 동작이 기록 실패로 막힌다')

  // 고객 쪽 서버 쓰기는 빠짐없이 남긴다 — app/api/subscriptions/** 에서 subscriptions 를 쓰는 라우트는 전부.
  const writers = walk(join(ROOT, 'app', 'api', 'subscriptions')).filter((p) =>
    /from\('subscriptions'\)\s*\.(update|insert)\(/.test(stripComments(readFileSync(p, 'utf8'))),
  )
  assert.ok(writers.length >= 2, `구독을 쓰는 고객 라우트를 못 찾았다: ${writers.map(rel).join(', ')}`)
  for (const p of writers) {
    assert.ok(stripComments(readFileSync(p, 'utf8')).includes('recordSubscriptionEvent('), `${rel(p)}: 구독을 바꾸는데 변경 기록을 남기지 않는다`)
  }
  const fr = code('app', 'api', 'subscriptions', '[id]', 'fresh-ratio', 'route.ts')
  assert.match(fr, /update\(\{ fresh_ratio: ratio, total_amount: quote\.total \}\)[\s\S]{0,900}recordSubscriptionEvent\(admin, \{[\s\S]{0,200}kind: 'fresh_ratio'/, '화식 비율 변경이 기록되지 않는다')
  const bi = code('app', 'api', 'payments', 'billing-issue', 'route.ts')
  const saveAt = bi.indexOf('if (saveErr) {')
  const recAt = bi.indexOf("kind: 'card'")
  assert.ok(saveAt > 0 && recAt > saveAt, '카드 등록이 기록되지 않는다(또는 저장 실패 전에 기록한다)')
  assert.ok(!/billing_key: result\.billingKey[\s\S]{0,50}kind: 'card'/.test(bi) && !/after: \{[^}]*billingKey/.test(bi), '카드 기록에 빌링키가 들어간다')
  const ap = code('app', 'api', 'personalization', 'approve', 'route.ts')
  assert.match(ap, /priceUpdated = true\s*if \(box\.prevTotal !== box\.total\) \{\s*await recordSubscriptionEvent\(admin, \{[\s\S]{0,200}kind: 'amount'/, '금액 동의가 기록되지 않는다')
  const cron = code('app', 'api', 'cron', 'personalization-progression', 'route.ts')
  assert.match(cron, /\.update\(\{ status: 'paused' \}\)[\s\S]{0,700}recordSubscriptionEvent\(supabase, \{[\s\S]{0,200}actor: 'cron',\s*kind: 'pause'/, '크론의 알레르기 일시정지가 기록되지 않는다')

  // 브라우저 쓰기(트리거가 잡는 쪽)는 그대로 로그인 클라이언트 — service_role 로 옮기면 트리거가 못 본다.
  for (const f of [['app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx'], ['app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx']]) {
    const src = code(...f)
    assert.ok(!src.includes('createAdminClient'), `${f.join('/')}: 브라우저 쓰기가 service_role 로 바뀌었다 — 변경 기록 트리거가 못 본다`)
    assert.match(src, /from\('subscriptions'\)\s*\.update\(/, `${f.join('/')}: 고객 쓰기 경로가 바뀌었다 — 변경 기록 경로를 다시 봐야 한다`)
  }
  // 고객 화면이 시간순으로 보인다.
  assert.match(code('app', 'admin', 'users', '[id]', '_data.ts'), /from\('subscription_events'\)[\s\S]{0,200}\.eq\('user_id', userId\)\s*\.order\('created_at', \{ ascending: false \}\)/)
})

test('규칙256: 챙길 손님 — 메일 반송·알림 못 받음·옛 안드 1.0.10·카드 재등록(상태 정본), 고객 화면 맨 위 + 회원 목록 필터 (C4)', async () => {
  const cf = await load<typeof import('./admin/customer-flags.ts')>('lib', 'admin', 'customer-flags.ts')
  const sub = (o: Record<string, unknown>) => ({
    status: 'active' as const,
    has_billing_key: true,
    next_delivery_date: '2026-10-20',
    failed_charge_count: 0,
    requires_billing_key_renewal: false,
    ...o,
  })
  const base = { email: 'A@Kakao.com', suppressedEmails: new Set<string>(), nativeTokens: [], webPushCount: 0, subscriptions: [] }
  assert.deepEqual(cf.customerFlags({ ...base, suppressedEmails: new Set(['a@kakao.com']) }).keys.includes('bounced'), true, '대소문자가 달라도 반송을 잡아야 한다')
  assert.deepEqual(cf.customerFlags(base).keys, ['no_push'], '토큰·웹 푸시가 없으면 알림 못 받음')
  assert.ok(!cf.customerFlags({ ...base, webPushCount: 1 }).keys.includes('no_push'), '웹 푸시가 있으면 알림은 받는다')
  const tok = (platform: string, v: string, at: string) => ({ platform, app_version: v, updated_at: at })
  assert.ok(cf.customerFlags({ ...base, nativeTokens: [tok('android', '1.0.10', '2026-10-10T00:00:00Z')] }).keys.includes('old_app'), '안드 1.0.10 을 옛 앱으로 안 잡는다')
  for (const v of ['1.0.11', '1.0.12', '1.1.0']) {
    assert.ok(!cf.customerFlags({ ...base, nativeTokens: [tok('android', v, '2026-10-10T00:00:00Z')] }).keys.includes('old_app'), `안드 ${v} 를 옛 앱으로 잡는다`)
  }
  assert.ok(!cf.customerFlags({ ...base, nativeTokens: [tok('ios', '1.0', '2026-10-10T00:00:00Z')] }).keys.includes('old_app'), 'iOS 를 안드 기준으로 잡는다')
  assert.ok(
    !cf.customerFlags({ ...base, nativeTokens: [tok('android', '1.0.10', '2026-09-01T00:00:00Z'), tok('android', '1.0.12', '2026-10-12T00:00:00Z')] }).keys.includes('old_app'),
    '최근 기기는 새 버전인데 옛 기기 토큰 때문에 옛 앱으로 잡는다',
  )
  assert.equal(cf.isBrokenAndroidVersion(null), false, '버전을 모르면 단정하지 않는다')
  assert.ok(cf.customerFlags({ ...base, subscriptions: [sub({ requires_billing_key_renewal: true })] }).keys.includes('card_renewal'))
  assert.ok(cf.customerFlags({ ...base, subscriptions: [sub({ failed_charge_count: 2 })] }).keys.includes('card_renewal'))
  assert.ok(!cf.customerFlags({ ...base, subscriptions: [sub({ status: 'cancelled', requires_billing_key_renewal: true })] }).keys.includes('card_renewal'), '해지된 구독을 카드 재등록으로 잡는다')
  assert.ok(!cf.customerFlags({ ...base, subscriptions: [sub({ has_billing_key: false })] }).keys.includes('card_renewal'), '카드 등록 전(시작 전)을 재등록으로 잡는다')
  assert.equal(cf.ANDROID_FIRST_FIXED_VERSION, '1.0.11')
  const nb = code('lib', 'native-build.ts')
  assert.match(nb, /androidIntentLinks: 12/, '고쳐진 첫 안드 빌드(12 = 1.0.11) 기준이 바뀌었다 — 옛 앱 판정 버전도 같이 봐야 한다')
  const cfSrc = code('lib', 'admin', 'customer-flags.ts')
  assert.match(cfSrc, /subscriptionState\(s\) === 'card_failed'/, '카드 재등록을 상태 정본 없이 판정한다')
  assert.equal(cf.parseFlagFilter('old_app'), 'old_app')
  assert.equal(cf.parseFlagFilter('drop table'), null)

  const ld = code('lib', 'admin', 'customer-flags-load.ts')
  for (const t of ['email_suppressions', 'native_push_tokens', 'push_subscriptions', 'subscriptions']) {
    assert.match(ld, new RegExp(`selectInChunks\\([^)]*\\(chunk\\) =>\\s*admin[\\s\\S]{0,40}\\.from\\('${t}'\\)`), `${t} 를 200개씩 나눠 묻지 않는다(규칙190)`)
  }
  assert.match(ld, /if \(res\.error\) return \{ ok: false/, '신호 조회 실패를 "신호 없음"으로 접는다(규칙1)')

  // 회원 목록 — service_role 조회 + 필터 칩 + 실패 표시.
  const list = code('app', 'admin', 'users', 'page.tsx')
  assert.match(list, /loadAllCustomerFlags\(createAdminClient\(\)\)/, '회원 목록이 알림 기기를 관리자 쿠키로 읽는다(RLS 0행 → 전원 알림 못 받음)')
  assert.match(list, /CUSTOMER_FLAG_KEYS\.map\(\(k\) => \(\s*<FilterChip/, '회원 목록에 신호별 필터가 없다')
  assert.match(list, /!flagRes\.ok && \([\s\S]{0,80}<LoadError/, '신호 조회 실패를 알리지 않는다')
  // 고객 화면 맨 위.
  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  const flagsAt = view.indexOf('CUSTOMER_FLAG_HINT[k]')
  const gridAt = view.indexOf('title="정기배송"')
  assert.ok(flagsAt > 0 && gridAt > flagsAt, '챙길 손님 배지가 고객 화면 맨 위에 없다')
})

test('규칙257: 배송지 고치기 — 기본 배송지(정본 1순위)·전화 정본·확인창·작업 기록, 금액·비율·고객 권한은 건드리지 않는다 (C5)', async () => {
  const r = code('app', 'api', 'admin', 'users', '[id]', 'address', 'route.ts')
  const gateAt = r.indexOf('await requireAdminUser()')
  const adminAt = r.indexOf('createAdminClient()')
  assert.ok(gateAt > 0 && adminAt > gateAt, '관리자 확인 전에 service_role 을 만든다')
  assert.match(r, /addressInputSchema\.extend\(/, '주소 검사가 정본(addressInputSchema)이 아니다')
  assert.match(r, /if \(!isKoreanMobile\(input\.phone\)\)[\s\S]{0,120}PHONE_ERROR/, '전화번호 검사가 정본(lib/phone)이 아니다')
  assert.match(r, /from\('addresses'\)[\s\S]{0,200}\.eq\('user_id', id\)\s*\.eq\('is_default', true\)/, '기본 배송지(정본 1순위)를 고치지 않는다')
  assert.match(r, /if \(curErr\) \{[\s\S]{0,120}DB_ERROR/, '기본 배송지 조회 실패를 "없음"으로 읽어 하나 더 만든다(규칙1)')
  assert.match(r, /insert\(\{ \.\.\.next, user_id: id, label: '기본 배송지', is_default: true \}\)/)
  assert.ok(!/from\('profiles'\)\s*\.update/.test(r), '프로필(회원 이름)을 받는 분으로 덮는다')
  assert.match(r, /\.not\('subscription_id', 'is', null\)\s*\.in\('payment_status', \[\.\.\.PAID_STATUSES\]\)\s*\.eq\('order_status', 'preparing'\)/, '결제된 발송 대기 박스만 고치지 않는다')
  assert.match(r, /recordAdminAction\(gate\.supabase, \{[\s\S]{0,80}action: 'customer_address_change'/, '작업 기록을 남기지 않는다')
  assert.ok(!/diff: \{[\s\S]{0,300}(next\.address|recipient_name: next)/.test(r), '작업 기록에 주소 원문이 들어간다(PII 최소화)')

  // 어드민 고객 라우트는 금액·비율·구독을 절대 쓰지 않는다.
  for (const p of walk(join(ROOT, 'app', 'api', 'admin', 'users'))) {
    const src = stripComments(readFileSync(p, 'utf8'))
    assert.ok(!/(fresh_ratio|total_amount)\s*:/.test(src), `${rel(p)}: 화식 비율·금액을 쓴다 — 금액 변경은 고객 동의로만`)
    assert.ok(!/from\('subscriptions'\)\s*\.(update|insert|upsert|delete)\(/.test(src), `${rel(p)}: 구독을 직접 바꾼다`)
    assert.ok(!/from\('dog_formulas'\)\s*\.(update|insert|upsert|delete)\(/.test(src), `${rel(p)}: 식단을 직접 바꾼다`)
  }
  // 새 마이그레이션은 고객 쓰기 권한·기존 표를 바꾸지 않는다.
  for (const n of ['20261014220000_admin_customer_notes.sql', '20261014220100_subscription_events.sql', '20261014220200_formula_proposal_requests.sql']) {
    const s = sqlCode(migration(n))
    assert.ok(!/grant (insert|update|delete|all)[^;]*to (anon|authenticated)/i.test(s), `${n}: 고객에게 쓰기 권한을 준다`)
    assert.ok(!/alter table public\.(subscriptions|profiles|addresses|surveys)\b/i.test(s), `${n}: 고객 표 권한·칸을 바꾼다`)
  }

  const ed = code('app', 'admin', 'users', '[id]', 'AddressEditor.tsx')
  assert.match(ed, /import AddressSearch from '@\/components\/AddressSearch'/, '주소검색이 정본 부품이 아니다')
  assert.match(ed, /window\.confirm\(/, '저장 전 확인창이 없다')
  assert.match(ed, /isKoreanMobile\(phone\)/)

  // 비율·금액은 '안내 보내기'만 — 고객이 앱에서 직접 고른다. 고객 문구 금지어 없음.
  const pre = await load<typeof import('../app/admin/users/[id]/message/presets.ts')>('app', 'admin', 'users', '[id]', 'message', 'presets.ts')
  const ratio = pre.messagePreset('ratio')
  assert.ok(ratio && ratio.url.startsWith('/'), '비율 변경 안내가 없다')
  for (const w of ['처방', '언제든', '%', '맞춤', '효능', '도착', '월요일', '화요일', '수요일', '목요일', '금요일']) {
    assert.ok(!ratio!.title.includes(w) && !ratio!.body.includes(w), `비율 변경 안내에 고객 문구 금지어 '${w}'`)
  }
  assert.equal(pre.messagePreset('__proto__'), null)
  assert.match(code('app', 'admin', 'users', '[id]', 'CustomerView.tsx'), /message\?preset=ratio/, '고객 화면에서 비율 변경 안내로 가는 길이 없다')
})

test('규칙258: 알레르기 고치기 — 설문 덮어쓰기 금지(관리자 수정 새 행), 박스 계산이 그 행을 읽고, 제안은 재제안 크론 경로로만 (C5)', async () => {
  const ae = await load<typeof import('./admin/allergy-edit.ts')>('lib', 'admin', 'allergy-edit.ts')
  const blocks = await load<typeof import('./personalization/dogAllergyBlocks.ts')>('lib', 'personalization', 'dogAllergyBlocks.ts')
  const sku = await load<typeof import('./personalization/skuMap.ts')>('lib', 'personalization', 'skuMap.ts')

  const latest = {
    id: 's-old',
    dog_id: 'd1',
    user_id: 'u1',
    created_at: '2026-10-01T00:00:00Z',
    care_goal: 'joint',
    chronic_conditions: ['arthritis'],
    answers: { allergies: [], bcsExact: 5, surveyVersion: 4 },
  }
  const frozen = JSON.stringify(latest)
  const row = ae.buildAdminAllergySurveyRow(latest, ['닭·칠면조'], { at: '2026-10-14T02:00:00Z', note: '카톡' })
  assert.equal(JSON.stringify(latest), frozen, '옛 설문 행을 바꾼다 — 설문은 기록이다')
  assert.ok(!('id' in row) && !('created_at' in row), '새 행이 옛 행의 id·작성 시각을 가져간다')
  assert.equal(row.user_id, 'u1', '새 행이 강아지 주인이 아니다 — 고객 화면·AI 상담이 못 읽는다')
  assert.equal(row.care_goal, 'joint', '다른 답(케어 목표)을 버린다 — 다음 제안이 틀어진다')
  assert.deepEqual(row.chronic_conditions, ['arthritis'])
  const ans = row.answers as { allergies: string[]; bcsExact: number; adminEdit: { prevAllergies: string[]; note?: string } }
  assert.deepEqual(ans.allergies, ['닭·칠면조'])
  assert.equal(ans.bcsExact, 5)
  assert.deepEqual(ans.adminEdit.prevAllergies, [], '관리자 수정 표식에 이전 알레르기가 없다')

  // 박스 계산이 그 행을 읽는다 — 최신 판정은 created_at, 누가 썼는지 묻지 않는다.
  const adminRow = { ...row, id: 's-admin', dog_id: 'd1', created_at: '2026-10-14T02:00:01Z' } as unknown as { dog_id: string; answers: unknown; created_at: string }
  const picked = blocks.latestSurveyByDog([latest, adminRow]).get('d1') as { answers: unknown } | undefined
  assert.equal((picked?.answers as { adminEdit?: unknown })?.adminEdit !== undefined, true, '최신 설문 판정이 관리자 수정 행을 고르지 않는다')
  const blocked = blocks.blockedLinesByDogFromSurveys([latest, adminRow]).get('d1') ?? []
  assert.deepEqual(blocked, sku.blockedLinesForAllergies(['닭·칠면조']), '박스 계산 입력(막힌 라인)이 고친 알레르기를 읽지 않는다')
  assert.ok(blocked.length > 0, '닭·칠면조가 막는 레시피가 없다 — 검사가 무의미하다')

  // 영향 — 정본 computeBoxPlan 으로 전·후. 지금 식단에 막힌 레시피가 있으면 담지 못한 몫(→ 포장 목록 멈춤).
  const line = blocked[0]!
  const slug = sku.LINE_TO_SLUG[line]!
  const products = { [slug]: { slug, price: 3000, sale_price: 2700, stock: 99, is_subscribable: true } }
  const lineRatios = { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, [line]: 1 } as Record<string, number>
  const impact = ae.allergyEditImpact({
    prevAllergies: [],
    nextAllergies: ['닭·칠면조'],
    serving: { formula: { lineRatios: lineRatios as never, toppers: { protein: 0, vegetable: 0 } }, daily_kcal: 600 },
    freshRatio: 50,
    products,
  })
  assert.ok(impact.computed && impact.heldAfter.length > 0 && impact.heldBefore.length === 0, '새 알레르기 레시피가 든 식단을 "영향 없음"으로 본다')
  assert.equal(impact.heldAfter[0]!.reason, 'allergen_in_formula')
  assert.deepEqual(impact.addedBlockedLines, blocked)
  assert.equal(ae.allergyEditImpact({ prevAllergies: [], nextAllergies: [], serving: null, freshRatio: null, products }).computed, false)
  // 값 검사 — 모르는 값은 막고, 이미 있던 옛 값은 지키고.
  assert.deepEqual(ae.validateNextAllergies(['닭·칠면조', '해킹'], []), { ok: false, invalid: ['해킹'] })
  assert.deepEqual(ae.validateNextAllergies(['계란'], ['계란']), { ok: true, allergies: ['계란'] })
  assert.ok(ae.sameAllergies(['연어·생선'], ['연어']), '옛 라벨과 새 라벨을 다른 값으로 본다')

  // 라우트 — 설문은 insert 만, 식단·구독은 안 쓴다, 제안은 요청 표로.
  const r = code('app', 'api', 'admin', 'users', '[id]', 'allergies', 'route.ts')
  assert.ok(!/from\('surveys'\)\s*\.(update|upsert|delete)\(/.test(r), '설문을 덮어쓴다 — 기록은 새 행으로')
  assert.match(r, /\.from\('surveys'\)\s*\.insert\(row\)/, '관리자 수정 새 행을 넣지 않는다')
  assert.match(r, /latestSurveyByDog\(/, '최신 설문을 정본 판정으로 고르지 않는다')
  assert.match(r, /if \(!dog \|\| dog\.user_id !== id\)/, '다른 고객의 강아지를 고칠 수 있다')
  assert.match(r, /recordAdminAction\(gate\.supabase, \{[\s\S]{0,60}action: 'dog_allergy_edit'/, '작업 기록을 남기지 않는다')
  assert.match(r, /if \(!i\.liveActive\) \{[\s\S]{0,120}NO_ACTIVE_SUBSCRIPTION/, '구독 중이 아닌데 제안을 예약한다')
  assert.match(r, /from\('formula_proposal_requests'\)\.insert\(/, '제안을 재제안 크론 요청으로 넣지 않는다')
  const ed = code('app', 'admin', 'users', '[id]', 'AllergyEditor.tsx')
  assert.match(ed, /window\.confirm\(msg\)/, '저장 전 확인창이 없다')
  assert.match(ed, /runPreview[\s\S]*action: 'preview'|post\('preview'\)/, '저장 전에 영향을 보여 주지 않는다')

  const sql = sqlCode(migration('20261014220200_formula_proposal_requests.sql'))
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.formula_proposal_requests from anon, authenticated;/)
  assert.match(sql, /create unique index if not exists formula_proposal_requests_one_open\s*on public\.formula_proposal_requests \(dog_id\)\s*where processed_at is null;/, '강아지당 대기 요청 1건이 아니다')

  // 크론 — 요청한 강아지는 박스 3개를 기다리지 않고, 나머지 가드는 그대로, 요청 조회 실패는 정기 재제안을 멈추지 않는다.
  const cron = code('app', 'api', 'cron', 'personalization-progression', 'route.ts')
  assert.match(cron, /const early = await loadEarlyProposalRequests\(supabase\)/)
  const afterLoad = cron.slice(cron.indexOf('const early = await loadEarlyProposalRequests(supabase)'), cron.indexOf('const earlyDogIds'))
  assert.ok(!/return NextResponse\.json/.test(afterLoad), '요청 조회 실패가 크론 전체를 멈춘다')
  assert.match(cron, /const allDogIds = earlyFirst\(Array\.from\(latestByDog\.keys\(\)\), earlyDogIds\)/, '요청한 강아지가 한 번에 처리하는 수에 밀릴 수 있다')
  assert.match(cron, /if \(!isCycleDue\(boxesShipped \?\? 0\) && !earlyDogIds\.has\(dogId\)\)/, '요청한 강아지도 박스 3개를 기다린다')
  assert.ok(cron.indexOf("if (cur.approval_status === 'pending_approval')") > 0 && cron.includes('pendingOutstanding += 1'), '승인 대기 중이면 겹쳐 만들지 않는 가드가 사라졌다')
  assert.match(cron, /closeEarlyProposalRequests\(supabase, earlyByDog, proposedDogIds\)/, '요청을 닫지 않는다 — 매일 다시 앞당긴다')
  const ep = await load<typeof import('./personalization/early-proposal.ts')>('lib', 'personalization', 'early-proposal.ts')
  assert.deepEqual(ep.earlyFirst(['a', 'b', 'c', 'd'], new Set(['c'])), ['c', 'a', 'b', 'd'])
  assert.equal(ep.EARLY_PROPOSAL_TTL_DAYS, 7)
})
