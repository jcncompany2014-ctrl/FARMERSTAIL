/**
 * 2026-10-14 어드민 강화 갈래 B(할 일·경보·홈)의 규칙 247~252 (가지 feat/admin-b-home).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(32d1ea8c)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 *   247 B1 경보 기록 — 사장님 일만 고른 정본 목록 · captureBusinessEvent 가 경보함에도 적는다 · 기록 실패가 흐름을 막지 않는다 · 표·함수 권한
 *   248 B1 경보함 화면 — 안 본 것 위 · 종류별 필터 · 각 경보에서 주문·구독·고객으로 · '처리함'(메모)은 관리자 확인 + 한 번만
 *   249 B2 이번 주 할 일 — 요일별 칸 · 포장은 포장 목록과 같은 판정(식 대조) · 홈·아침 브리핑이 같은 함수
 *   250 B2 레시피 동의 마감 — 정본 마감(금액 변경 3일·일반 5일·상담 없음) · 강아지 이름·보호자님으로
 *   251 B3 홈 숫자 — 내부 계정 판정 정본 · 진짜 해지만 · 표본 적으면 빨간불 대신 '표본 적음'
 *   252 B4 외부 키 만료 — 만료일 근거(설정일 + 수명) · 7·3·1일 전 경보(단계마다 한 번) · 키 값은 어디에도 없음
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

/** 공백을 하나로 — 줄바꿈·들여쓰기가 달라도 같은 식이면 같게 본다(식 대조용). */
function squash(src: string): string {
  return src.replace(/\s+/g, ' ')
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

// ─────────────────────────────────────────────────────────────────────────────

test('규칙247: 경보 기록 — 사장님이 직접 처리할 경보만 고른 정본 목록을 captureBusinessEvent 가 경보함(admin_alerts)에도 적고, 기록 실패는 흐름을 막지 않는다 (B1)', async () => {
  /**
   * # 왜 (2026-10-14 어드민 B1)
   * 업무 경보는 Sentry 로만 갔고 Sentry 메일은 사장님 Gmail 로 오지 않는다 — '토스에서 직접 환불하세요'·'다음 박스에 알레르기
   * 재료 — 구독을 멈췄어요' 같은 사람 일이 어디에도 안 남았다. 고른 이름만 경보함에 적는다(시끄러우면 아무도 안 본다).
   */
  const k = await load<typeof import('./admin/alert-kinds.ts')>('lib', 'admin', 'alert-kinds.ts')
  const MUST = [
    'personalization.next_box_allergen_leak',
    'personalization.leak_pause_failed',
    'refund_queue.needs_manual_check',
    'refund_queue.permanent_failure',
    'payment_ledger.mismatch',
    'subscription.charge.amount_mismatch',
    'subscription.charge.ambiguous_captured',
    'subscription.charge.refund_queue_insert_failed',
    'email.suppressed_skip',
    'subscription.charge.price_rise_consent_missing',
    'tracking.tracker_key_rejected',
    'ops.key_expiring',
  ]
  for (const n of MUST) assert.ok(k.isOwnerAlertKind(n), `경보함 목록에 ${n} 이 없다`)
  assert.equal(k.shouldRecordOwnerAlert('info', 'refund_queue.permanent_failure'), false, 'info 를 경보함에 적는다')
  // 2026-10-15 F-a(규칙267): cron.error 는 사장님 일 목록에 들어갔다(크론 + 날짜로 묶음) — 목록 밖 이름 예시를 바꿨다.
  assert.equal(k.shouldRecordOwnerAlert('error', 'subscription.charge.succeeded'), false, '목록에 없는 이름을 적는다 — 경보함이 시끄러워진다')
  assert.equal(k.shouldRecordOwnerAlert('error', 'refund_queue.permanent_failure'), true)
  // 광고 메일 수신 차단(warning)은 정상 동작 — 거래 메일 차단(error)만.
  assert.equal(k.shouldRecordOwnerAlert('warning', 'email.suppressed_skip'), false, '광고 메일 수신 차단(정상)까지 경보함에 적는다')
  assert.equal(k.shouldRecordOwnerAlert('error', 'email.suppressed_skip'), true, '거래 메일 차단을 경보함에 안 적는다')

  // 목록의 이름은 실제로 보내는 이름이어야 한다(오타면 영영 안 쌓인다). 병합(10/14) 뒤엔 예외 없이 전부 실제로 보내는 이름.
  const NOT_YET_EMITTED = new Set<string>([])
  const DYNAMIC = /^subscription\.charge\.replay_(unknown|booked)$/
  const srcs = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib'))).filter((f) => !f.endsWith(join('admin', 'alert-kinds.ts')))
  const corpus = srcs.map((f) => readFileSync(f, 'utf8')).join('\n')
  for (const n of Object.keys(k.OWNER_ALERT_KINDS)) {
    if (NOT_YET_EMITTED.has(n)) continue
    if (DYNAMIC.test(n)) {
      assert.ok(corpus.includes('`subscription.charge.replay_${verdict}`'), '재생 결제 이름(replay_${verdict})이 바뀌었다 — 목록을 맞출 것')
      continue
    }
    assert.ok(corpus.includes(`'${n}'`), `경보함 목록의 ${n} 을 보내는 곳이 없다(오타·이름 바뀜)`)
  }

  // 대상 묶음 — 구독 → 주문 → 강아지 → 고객, 'global' 종류는 한 줄.
  const sub = '11111111-1111-4111-8111-111111111111'
  const ord = '22222222-2222-4222-8222-222222222222'
  assert.equal(k.alertTargetKey('subscription.charge.paid_write_failed', { subscriptionId: sub, orderId: ord }), `sub:${sub}`, '같은 구독의 재시도 실패가 주문마다 따로 쌓인다')
  assert.equal(k.alertTargetKey('refund_queue.permanent_failure', { orderId: ord }), `order:${ord}`)
  assert.equal(k.alertTargetKey('subscription.charge.merchant_config_error', { subscriptionId: sub }), '', '설정 문제(global)가 구독마다 따로 쌓인다')
  assert.equal(k.alertTargetsOf({ orderId: 'not-a-uuid' }).orderId, null, 'uuid 가 아닌 값을 id 칸에 넣는다(기록이 깨진다)')
  // 문맥 — 이름·이메일·전화·키 값은 버린다.
  const clean = k.sanitizeAlertContext({
    orderId: ord,
    email: 'a@b.com',
    recipientName: '보호자',
    paymentKey: 'tgen_xxx',
    secretKey: 'live_sk_xxx',
    note: '고객 a@b.com 010-1234-5678 에게 연락',
    amount: 100,
  })
  const s = JSON.stringify(clean)
  assert.ok(!/a@b\.com|010-1234-5678|보호자|live_sk|tgen_/.test(s), `경보함 문맥에 개인정보·키가 남는다: ${s}`)
  assert.equal(clean.orderId, ord, '숫자만 마디인 uuid 를 계좌번호 모양으로 가려 바로 가기 링크가 깨진다')
  assert.equal(clean.amount, 100)
  // 남은 글자 속 개인정보는 Sentry 와 같은 정본(lib/sentry-scrub)으로 — 규칙33(휴대폰 정규식은 정본만)과 같은 이유.
  assert.ok(!/900101-1234567/.test(JSON.stringify(k.sanitizeAlertContext({ memo: '주민 900101-1234567' }))), '주민번호 모양을 안 가린다')
  assert.match(code('lib', 'admin', 'alert-kinds.ts'), /scrubSentryString\(raw\)/, '경보함 문맥 가리기가 정본(scrubSentryString)이 아니다')

  // captureBusinessEvent → 경보함(서버에서만 · 목록 판정 · 실패가 흐름을 막지 않음).
  const trace = code('lib', 'sentry', 'trace.ts')
  const cap = trace.slice(trace.indexOf('export function captureBusinessEvent('))
  assert.match(cap, /Sentry\.captureMessage\(message,[\s\S]{0,200}\}\)\s*forwardToOwnerInbox\(level, message, context\)/, 'captureBusinessEvent 가 경보함으로 넘기지 않는다')
  const fwd = trace.slice(trace.indexOf('function forwardToOwnerInbox('))
  assert.match(fwd, /if \(typeof window !== 'undefined'\) return/, '브라우저에서도 경보함 기록을 시도한다')
  assert.match(fwd, /if \(!shouldRecordOwnerAlert\(level, message\)\) return/, '목록 판정 없이 모든 경보를 넘긴다')
  assert.match(fwd, /import\('@\/lib\/admin\/alert-record'\)[\s\S]{0,200}\.catch\(/, '기록 모듈 실패를 잡지 않는다')
  assert.match(fwd, /try \{[\s\S]*\} catch \{/, '경보함 넘기기가 try 로 감싸져 있지 않다 — 원래 흐름을 깰 수 있다')
  const rec = code('lib', 'admin', 'alert-record.ts')
  assert.match(rec, /db\.rpc\('record_admin_alert'/, '경보 기록이 묶음 함수(record_admin_alert)를 안 쓴다')
  assert.match(rec, /after\(task\)/, '경보 기록이 응답을 기다리게 한다(after 로 응답 뒤에 적을 것)')
  assert.match(rec, /catch \{\s*void task\(\)/, '요청 범위 밖에서 after 가 던지면 기록을 버린다')
  assert.ok(!/captureBusinessEvent\(/.test(rec), '기록 실패를 captureBusinessEvent 로 알리면 되돌아와 다시 기록을 시도한다(고리)')
  assert.match(rec, /console\.error\([\s\S]{0,120}Sentry\.captureMessage\(/, '기록 실패를 서버 로그·Sentry 로 남기지 않는다')
  const recFn = rec.slice(rec.indexOf('export async function recordAdminAlert('), rec.indexOf('export function forwardOwnerAlert('))
  assert.match(recFn, /try \{[\s\S]*\} catch \(e\) \{/, 'recordAdminAlert 가 던질 수 있다')

  // 표·함수 — RLS · 고객 쓰기 없음 · 관리자 읽기 · 실행은 service_role 만 · 24시간 묶음 · 자기 검증.
  const mig = read('supabase', 'migrations', '20261014210000_admin_alerts.sql')
  assert.match(mig, /create table if not exists public\.admin_alerts/)
  assert.match(mig, /alter table public\.admin_alerts enable row level security/, 'RLS 를 안 켠다')
  assert.match(mig, /revoke all on table public\.admin_alerts from anon, authenticated/)
  assert.match(mig, /for select to authenticated\s*using \(public\.is_admin\(\)\)/, '관리자 읽기 정책이 없다')
  assert.ok(!/for (insert|update|delete|all) to authenticated/.test(mig), '고객(authenticated) 쓰기 정책이 있다')
  assert.match(mig, /pg_advisory_xact_lock/, '동시 기록이 두 줄을 만들 수 있다(잠금 없음)')
  assert.match(mig, /resolved_at is null\s*and a\.last_seen_at >= now\(\) - interval '24 hours'/, '같은 종류+대상 24시간 묶음이 아니다')
  assert.match(mig, /revoke all on function public\.record_admin_alert\([^)]*\) from public, anon, authenticated/, '고객이 기록 함수를 부를 수 있다')
  assert.match(mig, /grant execute on function public\.record_admin_alert\([^)]*\) to service_role/)
  assert.match(mig, /record_admin_alert\('__selftest__'[\s\S]*delete from public\.admin_alerts where kind = '__selftest__'/, '묶음 동작 자기 검증이 없다')
  const types = read('lib', 'supabase', 'types.ts')
  assert.ok(types.includes('admin_alerts: {') && types.includes('record_admin_alert: {'), 'lib/supabase/types.ts 에 경보함 표·함수 타입이 없다')
})

test('규칙248: 경보함 화면 — 안 본 것이 위, 종류별 필터, 각 경보에서 주문·구독·고객으로 바로, 처리함(메모)은 관리자 확인 뒤 한 번만 (B1)', async () => {
  const v = await load<typeof import('./admin/alert-view.ts')>('lib', 'admin', 'alert-view.ts')
  const base = {
    severity: 'error',
    message: 'x',
    occurrences: 1,
    first_seen_at: '2026-10-14T00:00:00Z',
    resolved_note: null,
    order_id: null,
    subscription_id: null,
    user_id: null,
    dog_id: null,
    context: {},
  }
  const owners = { userBySub: new Map([['sub-1', 'user-9']]), userByDog: new Map([['dog-1', 'user-8']]) }
  const views = [
    v.toAlertView({ ...base, id: 'done', kind: 'refund_queue.permanent_failure', last_seen_at: '2026-10-14T05:00:00Z', resolved_at: '2026-10-14T06:00:00Z', order_id: 'ord-1' }, owners),
    v.toAlertView({ ...base, id: 'warn', kind: 'payment_ledger.mismatch', severity: 'warning', last_seen_at: '2026-10-14T04:00:00Z', resolved_at: null }, owners),
    v.toAlertView({ ...base, id: 'err', kind: 'subscription.charge.paid_write_failed', last_seen_at: '2026-10-14T01:00:00Z', resolved_at: null, subscription_id: 'sub-1', order_id: 'ord-2' }, owners),
    v.toAlertView({ ...base, id: 'dog', kind: 'personalization.next_box_allergen_leak', last_seen_at: '2026-10-14T03:00:00Z', resolved_at: null, dog_id: 'dog-1' }, owners),
  ]
  const sorted = v.sortAlertViews(views).map((x) => x.id)
  assert.deepEqual(sorted.slice(-1), ['done'], '처리한 경보가 안 본 경보보다 위에 있다')
  assert.equal(sorted[sorted.length - 2], 'warn', '안 본 것 중 급한(error) 것이 확인(warning)보다 아래다')
  const err = views.find((x) => x.id === 'err')!
  assert.ok(err.links.some((l) => l.href === '/admin/orders/ord-2'), '경보에서 주문으로 바로 가지 못한다')
  assert.ok(err.links.some((l) => l.href === '/admin/users/user-9'), '구독 경보에서 그 고객 화면(구독)으로 가지 못한다')
  assert.ok(views.find((x) => x.id === 'dog')!.links.some((l) => l.href === '/admin/users/user-8'), '강아지 경보(알레르기 누출)에서 보호자 화면으로 가지 못한다')
  assert.ok(views.find((x) => x.id === 'done')!.links.some((l) => l.href === '/admin/refunds'), '환불 경보에서 환불 화면으로 가지 못한다')
  assert.ok(err.action && err.action.length > 0, '경보에 무엇을 하면 되는지(action)가 없다')

  const page = code('app', 'admin', 'alerts', 'page.tsx')
  assert.match(page, /if \(!\(await isAdmin\(supabase, user\)\)\) redirect/, '경보함 화면이 관리자 확인을 안 한다')
  assert.match(page, /\.is\('resolved_at', null\)/, '안 본 경보를 따로 읽지 않는다')
  assert.match(page, /FilterChip[\s\S]{0,200}href=\{`\/admin\/alerts\?g=\$\{k\}`\}/, '종류별 필터가 없다')
  assert.match(page, /openRes\.error \|\| doneRes\.error\)[\s\S]{0,80}<LoadError/, "경보 조회 실패를 '경보 없음'으로 보인다(규칙1)")
  const btn = code('app', 'admin', 'alerts', 'ResolveAlertButton.tsx')
  assert.match(btn, /fetch\(`\/api\/admin\/alerts\/\$\{id\}`,[\s\S]{0,120}method: 'PATCH'/, '처리함 버튼이 API 를 부르지 않는다')
  assert.match(btn, /body: JSON\.stringify\(\{ note:/, '처리 메모를 보내지 않는다')
  assert.match(btn, /if \(!res\.ok\) \{[\s\S]{0,120}setErr\(/, '저장 실패를 조용히 넘긴다')

  const api = code('app', 'api', 'admin', 'alerts', '[id]', 'route.ts')
  assert.match(api, /if \(!\(await isAdmin\(supabase, user\)\)\) \{[\s\S]{0,120}status: 403/, '처리함 API 가 관리자 확인을 안 한다')
  assert.match(api, /createAdminClient\(\)[\s\S]{0,200}\.from\('admin_alerts'\)[\s\S]{0,200}\.update\(\{ resolved_at:[\s\S]{0,200}\.is\('resolved_at', null\)/, '이미 처리한 경보의 메모를 덮는다(처리 전 행만 고칠 것)')
  assert.match(api, /if \(!data \|\| data\.length === 0\) \{[\s\S]{0,600}ALREADY_RESOLVED[\s\S]{0,80}status: 409/, "0행을 '저장됨'으로 말한다")
  assert.match(api, /recordAdminAction\(/, '처리함이 감사 기록을 안 남긴다')
  const shell = code('components', 'adminui', 'admin-shell-next.tsx')
  assert.match(shell, /nav\('\/admin\/alerts'/, '경보함이 어드민 메뉴에 없다')
})

test('규칙249: 이번 주 할 일 — 요일별 칸(토 결제·월 포장·화 발송·늘), 포장은 포장 목록과 같은 판정, 홈과 아침 브리핑이 같은 함수 (B2)', async () => {
  /**
   * # 왜 (2026-10-14 어드민 B2)
   * 홈·브리핑·포장 목록이 박스·결제를 각자 셌다(미발송 판정 복사 3벌 — 규칙154 의 같은 병). 숫자가 갈리면 두 화면이 다른 말을 한다.
   */
  const c = await load<typeof import('./admin/weekly-todo-core.ts')>('lib', 'admin', 'weekly-todo-core.ts')
  assert.equal(c.upcomingShipIso('2026-10-14'), '2026-10-20', '수요일의 눈앞 발송일이 다음 화요일이 아니다')
  assert.equal(c.upcomingShipIso('2026-10-20'), '2026-10-20', '화요일엔 오늘이 발송일이다')
  assert.deepEqual(c.weekAnchors('2026-10-20'), { saturday: '2026-10-17', monday: '2026-10-19' })
  // 결제된 박스 — 이번 화요일분·발송일 지난 미발송.
  const rows = [
    { id: 'o1', subscription_id: 's1', paid_at: '2026-10-17T00:10:00Z', created_at: '2026-10-17T00:10:00Z' },
    { id: 'o2', subscription_id: 's2', paid_at: '2026-10-03T00:10:00Z', created_at: '2026-10-03T00:10:00Z' },
  ]
  const next = new Map([['s1', '2026-11-03'], ['s2', '2026-10-20']])
  const paid = c.classifyPaidBoxes(rows, next, '2026-10-20', '2026-10-19')
  assert.equal(paid.paidForShip, 1, '이번 화요일에 나갈 결제 박스를 못 센다')
  assert.equal(paid.overdueUnshipped, 1, '발송 화요일이 지난 결제 박스를 미발송으로 안 센다')
  assert.equal(paid.dueToShip, 2, '이번 화요일까지 송장을 넣을 박스 수가 틀리다')
  // 결제 시점을 모르면 서포터즈를 '결제 실패'로 단정하지 않는다.
  const u = c.classifyUnchargedSubs([{ id: 's3', user_id: 'u3' }], null, '2026-10-20', '2026-10-18')
  assert.deepEqual([u.toCharge, u.notCharged, u.timingUnknown], [1, 0, true])
  const u2 = c.classifyUnchargedSubs([{ id: 's3', user_id: 'u3' }], new Map([['u3', 'before_cooking' as const]]), '2026-10-20', '2026-10-18')
  assert.deepEqual([u2.toCharge, u2.notCharged], [0, 1], '토요일 결제일이 지났는데 결제 안 된 구독을 결제 예정으로 센다')
  // 토요일 실패 → 일요일 재시도 성공 = 성공.
  const ch = c.cycleChargeResults([
    { subscription_id: 's1', status: 'failed', attempted_at: '2026-10-17T00:10:00Z', scheduled_for: '2026-10-17', error_code: 'X' },
    { subscription_id: 's1', status: 'succeeded', attempted_at: '2026-10-18T00:10:00Z', scheduled_for: '2026-10-18', error_code: null },
    { subscription_id: 's2', status: 'failed', attempted_at: '2026-10-17T00:10:00Z', scheduled_for: '2026-10-17', error_code: 'CARD' },
  ])
  assert.deepEqual(ch.succeeded, ['s1'], '재시도로 성공한 결제를 실패로 센다')
  assert.deepEqual(ch.failed.map((f) => f.subscriptionId), ['s2'])

  // 서포터즈 전환 — 청구와 같은 판정(100원 3회 남음 → 12/1 첫 반값, 정가는 2027-01-23(토) 결제부터).
  const tt = await load<typeof import('./admin/trial-transitions.ts')>('lib', 'admin', 'trial-transitions.ts')
  const trans = tt.nextTrialTransitions(
    [{ id: 'sub', user_id: 'u', dog_id: 'd', status: 'active', next_delivery_date: '2026-10-20', total_amount: 51500 }],
    new Map([['u', { cheap_remaining: 3, half_remaining: 4, cheap_price: 100, half_rate: 0.5 }]]),
  )
  assert.equal(trans.length, 1)
  assert.equal(trans[0]!.nextPhase, 'half')
  assert.equal(trans[0]!.shipIso, '2026-12-01', '첫 반값 박스가 12/1 이 아니다')
  assert.equal(trans[0]!.chargeIso, '2026-12-01', '서포터즈 구간 결제일이 발송일(화)이 아니다')
  assert.deepEqual([trans[0]!.fromAmount, trans[0]!.toAmount], [100, 25750])
  assert.equal(trans[0]!.fullChargeIso, '2027-01-23', '정가 첫 결제일이 2027-01-23(토)이 아니다')

  // 서포터즈 인상 동의(A 갈래 표 subscription_price_consents) — 인상 이름은 A 정본과 같고, 취소된 기록은 동의가 아니다.
  assert.equal(tt.consentRiseOf({ nextPhase: 'half' }), 'to_half')
  assert.equal(tt.consentRiseOf({ nextPhase: 'full' }), 'to_full', '정가로 오르는 인상(100원에서 바로 포함)이 to_full 이 아니다')
  const t0 = trans[0]!
  const consentRows = (rise: string, revoked: string | null) => [{ user_id: 'u', rise, consented_on: '2026-10-12', channel: 'instagram_dm', revoked_at: revoked }]
  assert.equal(tt.trialConsentState(t0, consentRows('to_half', null), '2026-10-20').status, 'recorded')
  assert.equal(tt.trialConsentState(t0, consentRows('to_half', '2026-10-13T00:00:00Z'), '2026-10-20').status, 'waiting', '취소된 동의 기록을 동의로 센다')
  assert.equal(tt.trialConsentState(t0, consentRows('to_full', null), '2026-11-05').status, 'urgent', '다른 인상(to_full)의 동의를 이번 인상(to_half) 동의로 센다 / 결제 30일 안인데 빨간불이 아니다')
  assert.equal(tt.trialConsentState({ ...t0, userId: 'other' }, consentRows('to_half', null), '2026-11-05').status, 'urgent', '다른 사람의 동의를 센다')

  // 포장 = 포장 목록과 같은 정본 함수 + 행 판정 입력 식이 글자 그대로 같다(하나만 바뀌면 빨간불).
  const pick = squash(code('app', 'admin', 'personalization', 'picking-list', 'page.tsx'))
  const pw = squash(code('lib', 'admin', 'packing-week.ts'))
  for (const fn of ['shipBlockReason(', 'computeBoxPlan(', 'subscribableItems(', 'computeBoxItems(', 'loadBlockedLinesByDog(', 'servingFormulaByDog(', 'chargeRunPassed(']) {
    assert.ok(pw.includes(fn), `이번 주 포장 요약이 정본 ${fn} 를 안 쓴다`)
  }
  const SAME = [
    'const hasPaidOrder = orderBySubId.has(sub.id) || shipped !== null',
    "pausedAfterCharge: sub.status === 'paused' && orderBySubId.has(sub.id),",
    "pausedBeforeCharge: sub.status === 'paused' && !hasPaidOrder,",
    'dateMovedAfterCharge: movedSubIds.has(sub.id),',
    'cannotCharge: !sub.has_billing_key || sub.requires_billing_key_renewal === true,',
    "skippedNotCharged: sub.status === 'active' && sub.next_delivery_date === chargedBumpDate && !hasPaidOrder,",
    'overdueNotCharged: sub.next_delivery_date != null && sub.next_delivery_date < shipDate && !hasPaidOrder,',
    "notChargedAfterRun: chargeRunPassed(chargeDateFor(shipDate, timingOf(sub.user_id)), nowForCharge) && sub.status === 'active' && sub.next_delivery_date != null && sub.next_delivery_date <= shipDate && !hasPaidOrder,",
    'chargeFailedToday: sub.last_failed_charge_at != null && kstDateOf(sub.last_failed_charge_at) === todayKstIsoDate(),',
    '`next_delivery_date.lte.${shipDate},next_delivery_date.eq.${chargedBumpDate}`',
    "const shippedSince = `${addDaysKst(shipDate, -6)}T00:00:00+09:00`",
    // A 갈래(인상 동의 보류) 병합 뒤 — 포장 목록과 같은 펼치기·같은 판정.
    'const nextRound = hasPaidOrder || !upcomingRound || upcomingRound.shipIso > shipDate ? null : upcomingRound',
    'priceConsentMissing: !hasPaidOrder && (nextRound?.held ?? false),',
    '{ fromIso, untilChargeIso: until, stopAtHold: true },',
  ]
  for (const e of SAME) {
    assert.ok(pick.includes(e), `포장 목록에서 이 식이 바뀌었다 — lib/admin/packing-week 도 같이 바꿀 것: ${e}`)
    assert.ok(pw.includes(e), `이번 주 포장 요약의 식이 포장 목록과 다르다: ${e}`)
  }
  // '확인 필요' 항목 = 포장 목록 problemCount 와 같은 집합.
  const pc = /const problemCount = rows\.filter\(([\s\S]*?)\)\.length/.exec(code('app', 'admin', 'personalization', 'picking-list', 'page.tsx'))?.[1] ?? ''
  const flags = [...new Set([...pc.matchAll(/r\.(\w+)/g)].map((m) => m[1]))].sort()
  assert.deepEqual(flags, ['cannotCharge', 'chargeFailedToday', 'dateMovedAfterCharge', 'freshUnknown', 'held', 'missing', 'noFormula', 'notChargedAfterRun', 'overdue', 'overdueNotCharged', 'pausedAfterCharge', 'pausedBeforeCharge', 'priceConsentMissing', 'skippedNotCharged'], "포장 목록의 '확인 필요' 항목이 바뀌었다 — lib/admin/packing-week 의 problems 도 맞출 것")
  for (const p of ['no_formula', 'fresh_unknown', 'overdue_paid', 'cannot_charge', 'charge_failed_today', 'paused_before_charge', 'skipped_not_charged', 'overdue_not_charged', 'not_charged_after_run', 'paused_after_charge', 'date_moved_after_charge', 'missing_items', 'allergy_check_needed', 'price_consent_missing']) {
    assert.ok(pw.includes(`problems.push('${p}')`), `이번 주 포장 요약이 '확인 필요' ${p} 를 안 센다`)
  }
  assert.match(pw, /if \(subsErr\) return fail\(/, '구독 조회 실패를 0박스로 접는다')
  assert.match(pw, /if \(shippedErr\) return fail\(/, '결제 증거 조회 실패를 0박스로 접는다(규칙190)')
  assert.match(pw, /if \(!blocks\.ok\) return fail\(/, '설문 조회 실패를 알레르기 없음으로 접는다')

  // 할 일 조회 — 요일 칸 4개 · 항목마다 처리하러 가기.
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  for (const d of ["key: 'sat'", "key: 'mon'", "key: 'tue'", "key: 'always'"]) assert.ok(wt.includes(d), `이번 주 할 일에 ${d} 칸이 없다`)
  const items = (wt.match(/\n\s+key: '[a-z-]+',\n\s+title:/g) ?? []).length
  const hrefs = (wt.match(/hrefLabel: /g) ?? []).length
  assert.ok(items >= 10 && hrefs >= items, `항목(${items})마다 '처리하러 가기'(${hrefs})가 없다`)
  assert.match(wt, /loadPackingWeek\(db, shipIso, now\)/, '월요일 포장 칸이 포장 판정 정본을 안 쓴다')
  assert.match(wt, /classifyPaidBoxes\(subOrders, nextBySub, shipIso, today\)/)
  assert.match(wt, /classifyUnchargedSubs\(pending, timings, shipIso, today\)/)
  for (const k of ['admin_alerts', 'requires_billing_key_renewal', 'cs_messages', 'pending_approval', 'subscription_trials', 'admin_key_expiry', 'subscription_price_consents']) {
    assert.ok(wt.includes(k), `'늘' 칸이 ${k} 를 안 본다`)
  }
  // 동의 표 조회는 조건 없이 늘 — 표가 없거나 실패하면 '못 읽음'(동의 없음으로도, 받음으로도 단정하지 않는다).
  assert.match(wt, /\.from\('subscription_price_consents'\)\s*\.select\('user_id, rise, consented_on, channel, revoked_at'\)\s*\.is\('revoked_at', null\)/, '동의 표를 유효한 기록만 읽지 않는다')
  assert.match(wt, /if \(priceConsentsRes\.error\) failures\.push\(/, "동의 표 조회 실패를 '동의 없음'으로 접는다(규칙1)")
  assert.match(wt, /trialConsentState\(t, consentRows, today\)/, '전환마다 동의 상태를 정본 판정으로 안 낸다')
  assert.match(wt, /out\.push\(`✍️ 서포터즈 인상 동의 없음/, '브리핑에 인상 동의 없음 줄이 없다')
  assert.ok(read('lib', 'supabase', 'types.ts').includes('subscription_price_consents: {'), 'lib/supabase/types.ts 에 동의 표 타입이 없다')

  // 홈과 아침 브리핑이 같은 함수.
  const home = code('app', 'admin', 'page.tsx')
  assert.match(home, /loadWeeklyTodo\(opsDb, now\)/, '어드민 홈이 이번 주 할 일을 안 부른다')
  assert.ok(home.indexOf('<WeeklyTodoPanel') > 0 && home.indexOf('<WeeklyTodoPanel') < home.indexOf('<ActionsPanel'), '이번 주 할 일이 홈 맨 위(처리 대기 위)가 아니다')
  assert.match(home, /const overdueUnshippedCount = todo\.numbers\.overdueUnshipped/, '홈 미발송을 따로 센다')
  assert.match(home, /const csUnansweredUserCount = todo\.numbers\.csUnansweredUsers/)
  assert.match(home, /const cardRenewalCount = todo\.numbers\.cardRenewal/)
  assert.ok(!/paidBoxShipIso\(/.test(home), '홈이 미발송 판정을 따로 한다(복사본)')
  const br = code('app', 'api', 'cron', 'daily-briefing', 'route.ts')
  assert.match(br, /loadWeeklyTodo\(supabase\)/, '아침 브리핑이 이번 주 할 일과 같은 함수를 안 쓴다')
  assert.match(br, /const \{ paidForShip, overdueUnshipped, toCharge, notCharged \} = todo\.numbers/, '브리핑 박스 숫자를 따로 센다')
  assert.match(br, /items\.push\(\.\.\.briefingExtraLines\(todo\)\)/, '브리핑에 경보함·키·포장·동의 마감 줄이 없다')
  assert.match(br, /countFailures\.push\(\.\.\.todo\.failures\)/, "할 일 쪽 '못 셈'을 브리핑이 버린다(규칙1)")
  for (const dup of ['paidBoxShipIso(', 'getChargeTimings(', "from('cs_messages')", "eq('requires_billing_key_renewal', true)"]) {
    assert.ok(!br.includes(dup), `브리핑이 ${dup} 로 따로 센다(같은 판정 두 곳)`)
  }
})

test('규칙250: 레시피 동의 마감 — 정본(금액 변경 3일·일반 5일·상담 필요는 마감 없음) 하나로, 화면엔 강아지 이름·보호자님 (B2)', async () => {
  const d = await load<typeof import('./personalization/approval-deadline.ts')>('lib', 'personalization', 'approval-deadline.ts')
  const at = '2026-10-10T00:00:00.000Z'
  assert.equal(d.approvalDeadlineIso({ proposed_at: at, formula: {} }), '2026-10-15T00:00:00.000Z', '일반 제안 마감이 5일이 아니다')
  assert.equal(d.approvalDeadlineIso({ proposed_at: at, formula: { priceChange: { from: 1, to: 2, forced: false } } }), '2026-10-13T00:00:00.000Z', '금액 변경 제안 마감이 3일이 아니다')
  assert.equal(d.approvalDeadlineIso({ proposed_at: at, formula: { needsConsultation: true } }), null, '상담 필요 건에 마감이 있다(크론이 닫으면 안 된다)')
  assert.equal(d.approvalExpired({ proposed_at: at, formula: {} }, new Date('2026-10-14T23:59:59Z')), false)
  assert.equal(d.approvalExpired({ proposed_at: at, formula: {} }, new Date('2026-10-15T00:00:00Z')), true)
  const left = d.approvalTimeLeft({ proposed_at: at, formula: { priceChange: {} } }, new Date('2026-10-12T00:00:00Z'))
  assert.ok(left && left.imminent && left.hoursLeft === 24, '금액 변경 제안의 마감 임박(48시간 안)을 못 잡는다')

  const page = code('app', 'admin', 'personalization', 'page.tsx')
  assert.ok(!/dog_id\.slice\(0, 8\)/.test(page), '동의 마감 임박에 강아지 id 앞 8자리가 보인다 — 이름으로')
  assert.match(page, /approvalTimeLeft\(r, nowForDeadline\)/, "레시피 승인 화면이 마감을 따로 센다('5일 − 지난 날')")
  assert.match(page, /nearDogName\.get\(r\.dog_id\)[\s\S]{0,60}nearUserName\.get\(r\.user_id\)/, '동의 마감 임박이 강아지 이름·보호자님으로 안 보인다')
  assert.match(page, /href=\{`\/admin\/users\/\$\{r\.user_id\}`\}/, '동의 마감 임박에서 그 고객으로 바로 못 간다')
  const cron = code('app', 'api', 'cron', 'personalization-approval-timeout', 'route.ts')
  assert.match(cron, /if \(!approvalExpired\(row, nowDate\)\) continue/, '마감 크론이 정본 마감을 안 쓴다(두 곳 판정)')
  assert.ok(!/5 \* 24 \* 60 \* 60 \* 1000/.test(cron), '마감 크론에 5일 계산이 따로 남아 있다')
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(wt, /approvalTimeLeft\(f, now\)/, '이번 주 할 일의 동의 마감이 정본을 안 쓴다')
  assert.match(wt, /who\(x\.f\.dog_id, x\.f\.user_id\)/, '이번 주 할 일의 동의 마감에 강아지·보호자 이름이 없다')
})

test("규칙251: 홈 숫자 — 내부 계정 판정 정본(app_metadata.role=admin ∪ 명시 목록)으로 지표에서 빼고, 해지는 진짜 해지만, 표본이 적으면 빨간불 대신 '표본 적음' (B3)", async () => {
  /**
   * # 왜 (2026-10-14 운영 DB 확인)
   * '해지 2명 · 해지율 25%'(빨강)는 둘 다 카드 등록 전에 그만둔 신청(결제 0회, 정리 크론이 닫음)이었고 같은 강아지로 곧 다시
   * 신청해 지금 진행 중이다. 매출·구독엔 사장님 시험 구독(32,700원 × 2주)이 고객처럼 섞였다.
   */
  const ia = await load<typeof import('./admin/internal-accounts.ts')>('lib', 'admin', 'internal-accounts.ts')
  const adminId = 'f64d1e3f-0000-4000-8000-000000000000'
  const ok = await ia.loadInternalUserIds({ rpc: async () => ({ data: [{ id: adminId }, { id: 'nope' }], error: null }) })
  assert.ok(ok.ok && ok.ids.has(adminId) && !ok.ids.has('nope'), '관리자 계정(admin_user_ids)을 내부 계정으로 못 잡는다')
  const bad = await ia.loadInternalUserIds({ rpc: async () => ({ data: null, error: { message: 'boom' } }) })
  assert.equal(bad.ok, false, "내부 계정 조회 실패를 '내부 계정 없음'으로 읽는다(규칙1)")
  assert.equal(ia.excludeInternalFilter(new Set([adminId])), `user_id.is.null,user_id.not.in.(${adminId})`, '탈퇴로 user_id 가 빈 주문까지 매출에서 빠진다(not.in 만 쓰면 NULL 도 빠진다)')
  assert.equal(ia.excludeInternalFilter(new Set()), null)
  assert.equal(ia.excludeInternalFilter(new Set(['x) or (1=1'])), null, 'uuid 가 아닌 값을 필터에 끼워 넣는다')

  const ch = await load<typeof import('./admin/churn.ts')>('lib', 'admin', 'churn.ts')
  const live = new Set(['dog-a'])
  // 운영의 두 건 — 결제 0회로 닫힘(카드 등록 전 포기) + 같은 강아지 재신청.
  assert.equal(ch.classifyCancellation({ id: 'c1', dog_id: 'dog-a', last_charged_at: null, total_deliveries: 0 }, live), 'never_charged', '카드 등록 전 포기를 해지로 센다')
  assert.equal(ch.classifyCancellation({ id: 'c2', dog_id: 'dog-a', last_charged_at: '2026-10-06T00:10:00Z', total_deliveries: 1 }, live), 'resubscribed', '같은 강아지로 다시 구독 중인 해지를 떠난 것으로 센다')
  assert.equal(ch.classifyCancellation({ id: 'c3', dog_id: 'dog-b', last_charged_at: '2026-10-06T00:10:00Z', total_deliveries: 1 }, live), 'real')
  const small = ch.churnSummary({ activeCount: 6, realCancelled: 1 })
  assert.equal(small.smallSample, true)
  assert.equal(small.tone, 'neutral', '구독 7건에서 1명 해지(14%)에 빨간불을 켠다')
  assert.equal(small.ratePct, null, '표본이 적은데 비율을 보인다')
  assert.match(small.caption, /표본 적음/)
  const big = ch.churnSummary({ activeCount: 40, realCancelled: 3 })
  assert.equal(big.tone, 'red', '표본이 충분한데 5% 넘는 해지에 빨간불이 안 켜진다')

  const home = code('app', 'admin', 'page.tsx')
  assert.match(home, /loadInternalUserIds\(opsDb\)/, '홈이 내부 계정 판정 정본을 안 쓴다')
  for (const q of ["select('total_amount, refunded_amount', { count: 'exact' })", "select('id, user_id, total_amount', { count: 'exact' })"]) {
    const i = home.indexOf(q)
    assert.ok(i > 0 && /ex\(\s*supabase\s*\.from\('(orders|subscriptions)'\)\s*\.$/.test(home.slice(Math.max(0, i - 80), i)), `내부 계정을 안 빼는 지표 쿼리: ${q}`)
  }
  assert.match(home, /classifyCancellation\(s, liveDogIds\) === 'real'/, "홈 '구독 해지'가 진짜 해지만 세지 않는다")
  assert.match(home, /const churn = churnSummary\(/, '홈 해지율이 표본 크기를 안 본다')
  assert.ok(!/churnRatePct > 5/.test(home), '해지율 5% 빨간불이 표본과 무관하게 남아 있다')
  assert.match(home, /!internal\.ok && \(\s*<QueryErrorCard/, '내부 계정을 못 뺀 사실을 화면에 안 보인다')
})

test('규칙252: 외부 키 만료 — 설정일 + 수명으로 만료일을 계산해 7·3·1일 전에 경보함·브리핑에 올리고(단계마다 한 번), 키 값은 어디에도 없다 (B4)', async () => {
  const k = await load<typeof import('./admin/key-expiry.ts')>('lib', 'admin', 'key-expiry.ts')
  assert.equal(k.EXTERNAL_KEYS.delivery_tracker.lifetimeDays, 21, '배송조회 무료 키 수명이 21일이 아니다')
  assert.equal(k.EXTERNAL_KEYS.instagram_dm.lifetimeDays, 60, '인스타 장기 토큰 수명이 60일이 아니다')
  assert.equal(k.expiryFromSetOn('delivery_tracker', '2026-10-09'), '2026-10-30', '10/9 설정 키의 만료가 10/30 이 아니다')
  const st = (expires: string, today: string) => k.keyExpiryState('delivery_tracker', { key_name: 'delivery_tracker', set_on: null, expires_on: expires }, today)
  assert.equal(st('2026-10-30', '2026-10-22').stage, null, '8일 남았는데 경보한다')
  assert.equal(st('2026-10-30', '2026-10-23').stage, 7)
  assert.equal(st('2026-10-30', '2026-10-27').stage, 3)
  assert.equal(st('2026-10-30', '2026-10-29').stage, 1)
  assert.equal(st('2026-10-30', '2026-10-31').stage, 0)
  assert.equal(k.keyExpiryState('instagram_dm', null, '2026-10-14').tone, 'unknown', "만료일을 모르는 키를 '괜찮음'으로 보인다")
  const a7 = k.keyExpiryAlert(st('2026-10-30', '2026-10-23'))
  const a1 = k.keyExpiryAlert(st('2026-10-30', '2026-10-29'))
  assert.ok(a7 && a1 && a7.targetKey !== a1.targetKey, '7일·1일 전 경보가 한 줄로 묶인다(단계마다 따로)')
  assert.equal(a7!.level, 'warning')
  assert.equal(a1!.level, 'error')
  assert.ok(a7!.targetKey.includes('2026-10-30'), '키를 새로 받아도(만료일 바뀜) 옛 단계 경보에 묶인다')

  const mig = read('supabase', 'migrations', '20261014210100_admin_key_expiry.sql')
  assert.match(mig, /enable row level security/)
  assert.match(mig, /for select to authenticated\s*using \(public\.is_admin\(\)\)/)
  assert.match(mig, /'delivery_tracker', date '2026-10-09', date '2026-10-30'/, '배송조회 키 첫 값(10/9 → 10/30)이 없다')
  assert.match(mig, /'instagram_dm', date '2026-09-22', date '2026-11-21'/, '인스타 토큰 첫 값(→ 11/21)이 없다')
  const table = /create table if not exists public\.admin_key_expiry \(([\s\S]*?)\n\);/.exec(mig)?.[1] ?? ''
  assert.ok(table && !/\b(secret|token|value|api_key)\b/i.test(table), '만료일 표에 키 값 칸이 있다 — 날짜만')

  const api = code('app', 'api', 'admin', 'key-expiry', 'route.ts')
  assert.match(api, /if \(!\(await isAdmin\(supabase, user\)\)\)/, '키 설정일 API 가 관리자 확인을 안 한다')
  const body = /const zBody = z\.object\(\{([\s\S]*?)\}\)/.exec(api)?.[1] ?? ''
  assert.deepEqual([...body.matchAll(/(\w+):/g)].map((m) => m[1]), ['keyName', 'setOn', 'expiresOn', 'note'], '키 설정일 API 가 날짜 말고 다른 것(키 값)을 받는다')
  assert.match(api, /expiryFromSetOn\(keyName, setOn\)/, '만료일을 정본(설정일 + 수명)으로 안 낸다')

  const br = code('app', 'api', 'cron', 'daily-briefing', 'route.ts')
  assert.match(br, /raiseKeyExpiryAlerts\(supabase, todo\.numbers\.keys\)/, '아침 브리핑이 키 만료 경보를 경보함에 안 올린다')
  const kea = code('lib', 'admin', 'key-expiry-alerts.ts')
  assert.match(kea, /\.eq\('target_key', a\.targetKey\)[\s\S]{0,200}if \(\(data \?\? \[\]\)\.length > 0\) continue/, '같은 단계 키 만료 경보를 매일 다시 적는다')
  assert.match(kea, /if \(error\) \{[\s\S]{0,120}failures\.push/, "기존 경보 확인 실패를 '없음'으로 읽고 넘어간다")
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(wt, /for \(const k of n\.keys\) if \(k\.tone === 'bad' \|\| k\.tone === 'warn'\) out\.push\(`🔑/, '브리핑에 만료 임박 키 줄이 없다')
  assert.match(wt, /tossKeyStatus\(process\.env\.NEXT_PUBLIC_TOSS_CLIENT_KEY, process\.env\.TOSS_SECRET_KEY\)\.isLive/, "토스 '라이브 전환' 판정이 접두사 정본이 아니다")

  // 배송조회 키 거절·누락·깨짐 → 경보함(사유만, 키 값 없음).
  const tp = code('app', 'api', 'cron', 'tracking-poll', 'route.ts')
  assert.equal((tp.match(/reportTrackerKeyProblem\('TRACKER_/g) ?? []).length, 4, '배송조회 키 문제 네 갈래(없음·깨짐·자가점검 거절·조회 중 거절) 중 경보함에 안 올리는 곳이 있다')
  assert.match(tp, /captureBusinessEvent\('error', 'tracking\.tracker_key_rejected', \{ reason \}\)/, '배송조회 키 경보에 사유 말고 다른 값이 들어간다')

  // 화면 — 키 값을 내지 않는다(process.env 는 접두사 판정 함수 인자로만).
  for (const f of [['app', 'admin', 'alerts', 'page.tsx'], ['app', 'admin', 'alerts', 'KeyExpiryPanel.tsx'], ['lib', 'admin', 'weekly-todo.ts']]) {
    const src = code(...f)
    for (const m of src.matchAll(/process\.env\.\w+/g)) {
      const before = src.slice(Math.max(0, m.index! - 60), m.index!)
      assert.match(before, /tossKeyStatus\(\s*(process\.env\.\w+,\s*)?$/, `${f.join('/')} 가 환경값을 판정 함수 밖에서 쓴다 — 키 값이 화면에 샐 수 있다`)
    }
  }
  assert.ok(!/process\.env/.test(code('app', 'admin', 'alerts', 'KeyExpiryPanel.tsx')), '키 만료 칸(브라우저)이 환경값을 읽는다')
})
