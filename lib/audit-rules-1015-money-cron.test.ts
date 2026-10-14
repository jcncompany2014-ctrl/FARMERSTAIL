/**
 * 2026-10-15 어드민 수정 갈래 F-a '돈·크론' 의 규칙 259~269 (가지 fix/1015-money-cron).
 *
 * 2026-10-14 어드민 20관점 조사에서 나온 급한 것·그날 배포한 새 기능의 결함을 고친 것을 테스트로 박는다.
 * 각 규칙은 고친 코드를 일부러 되돌려 빨간불이 되는지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 *   259 DB — 서포터즈 도장 취소를 행 삭제가 아니라 기록으로(남은 회차 0 + 취소 시각 + 남은 회차 보관, 모양 제약·자기 검증)
 *   260 도장 취소·다시 찍기 — 서포터즈 가격 결제가 있었으면 남기고(청구 크론이 정가 인상 동의를 요구), 없으면 지운다. 다시 찍으면 되살린다
 *   261 회차 되돌림은 발송 전 박스의 환불만(배송 횟수 되돌림과 같은 조건) · 환불 패널 안내 · 도장 회수는 그대로
 *   262 열린 청구 보류 정리 — 해지·정지·발송일 변경·동의 기록이면 닫는다(크론 끝 정리 + 화면 '정리 예정'), 청구 성공은 도장 여부 없이 닫는다
 *   263 보류 기록·닫기·정리·동의 조회 실패를 경보함에
 *   264 달력 칸·그날 목록·구독 목록이 '인상 동의 없음 → 보류'와 실제 금액을 안다(정본 펼치기)
 *   265 자동결제 이력 요약 숫자는 사장님 시험 계정을 뺀다(홈과 같은 정본)
 *   266 알레르기·건강 강제 제안 3일 무응답 — 손님에게 '그대로 적용' 거짓 안내 금지 · 경보함 '연락 필요' · 목록에 표시
 *   267 크론 실패 — 경보함(크론 + KST 날짜로 묶음)·Sentry 크론별 묶음·태그
 *   268 아침 알림 워치독 — 09:10 정기결제가 안 돌면 같은 날 09:40 브리핑에 잡힌다
 *   269 체험단 화면 — 동의 기록·취소 실패와 인터넷 끊김이 누른 그 카드 안에 보인다
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

/** 함수 하나의 본문 — `export async function NAME(` 부터 다음 `export ` 직전까지. */
function fnBody(src: string, head: string): string {
  const at = src.indexOf(head)
  assert.ok(at >= 0, `${head} 가 없다`)
  const next = src.indexOf('\nexport ', at + head.length)
  return src.slice(at, next < 0 ? undefined : next)
}

type PR = typeof import('./payments/price-rise.ts')
type TC = typeof import('./payments/trial-cancel.ts')
type CP = typeof import('./payments/charge-projection.ts')
type SS = typeof import('./shipping-schedule.ts')

const SUP = { cheap_remaining: 3, half_remaining: 4, cheap_price: 100, half_rate: 0.5 }
const full = (amt: number) => ({ first: { amount: amt, label: null }, recurring: { amount: amt, label: null } })

// ─────────────────────────────────────────────────────────────────────────────

test('규칙259: 서포터즈 도장 취소는 행 삭제가 아니라 기록 — 남은 회차 0 + 취소 시각 + 남은 회차 보관(모양 제약·자기 검증·권한 그대로)', () => {
  const mig = read('supabase', 'migrations', '20261015100000_subscription_trials_soft_cancel.sql')
  for (const c of ['cancelled_at timestamptz', 'cancelled_by uuid', 'cancelled_cheap_remaining integer', 'cancelled_half_remaining integer']) {
    assert.ok(mig.includes(`add column if not exists ${c}`), `subscription_trials 에 ${c} 칸이 없다`)
  }
  // 취소됨 → 남은 회차 반드시 0(청구 크론이 '정가 인상'으로 본다) + 보관한 회차 둘 다 있음.
  const shape = mig.slice(mig.indexOf('add constraint subscription_trials_cancel_shape_check'))
  assert.match(shape, /cancelled_at is null and cancelled_cheap_remaining is null and cancelled_half_remaining is null/, '취소 안 된 도장의 모양이 고정되지 않았다')
  assert.match(shape, /cancelled_at is not null\s+and cheap_remaining = 0\s+and half_remaining = 0/, '취소된 도장의 남은 회차가 0 으로 고정되지 않았다(취소 뒤에도 100원이 나갈 수 있다)')
  assert.match(mig, /do \$\$[\s\S]*has_table_privilege\('authenticated', 'public\.subscription_trials', 'select'\)[\s\S]*raise exception/, '자기 검증(고객 권한 없음)이 없다')
  assert.ok(!/\bgrant\b/i.test(stripComments(mig.replace(/--[^\n]*/g, ''))), '도장 표에 권한을 새로 준다 — service_role 전용이어야 한다')
  const types = read('lib', 'supabase', 'types.ts')
  const block = types.slice(types.indexOf('      subscription_trials: {'), types.indexOf('      subscription_price_consents: {'))
  assert.equal((block.match(/cancelled_at\??: string \| null/g) ?? []).length, 3, 'types.ts 의 subscription_trials 에 취소 칸이 없다(Row·Insert·Update)')
})

test('규칙260: 도장 취소 — 서포터즈 가격 결제가 있었으면 남겨 청구 크론이 정가 인상 동의를 요구하고, 없으면 지운다. 다시 찍으면 남은 회차로 되살린다', async () => {
  const tc = await load<TC>('lib', 'payments', 'trial-cancel.ts')
  const pr = await load<PR>('lib', 'payments', 'price-rise.ts')
  const cp = await load<CP>('lib', 'payments', 'charge-projection.ts')
  const ss = await load<SS>('lib', 'shipping-schedule.ts')

  // ① 판정 — 결제 있음 = soft, 없음 = delete, 이미 취소 = already.
  const live = { cheap_remaining: 3, half_remaining: 4 }
  assert.equal(tc.trialCancelPlan({ row: live, hasSupporterPaid: true }), 'soft', '100원 결제가 있는 서포터즈의 도장을 지운다 — 동의 장치를 건너뛴 정가 결제가 나간다')
  assert.equal(tc.trialCancelPlan({ row: live, hasSupporterPaid: false }), 'delete', '잘못 찍은 도장(서포터즈 결제 없음)까지 남긴다')
  const patch = tc.softCancelPatch(live, '2026-10-15T01:00:00.000Z', 'admin-1')
  assert.deepEqual(
    [patch.cheap_remaining, patch.half_remaining, patch.cancelled_cheap_remaining, patch.cancelled_half_remaining],
    [0, 0, 3, 4],
    '취소 기록이 남은 회차 0 + 보관(3·4)이 아니다',
  )
  const cancelled = { ...live, ...patch }
  assert.equal(tc.trialCancelPlan({ row: cancelled, hasSupporterPaid: true }), 'already')
  const restored = tc.restorePatch(cancelled)
  assert.deepEqual([restored?.cheap_remaining, restored?.half_remaining, restored?.cancelled_at], [3, 4, null], '다시 찍기가 취소 때 남은 회차(3·4)로 되살리지 않는다(새로 4+4 면 100원 박스가 한 번 더 나간다)')
  assert.equal(tc.restorePatch(live), null, '취소 안 된 도장을 다시 찍기로 바꾼다')

  // ② 청구 크론의 판정 — 취소된 도장(0·0) + 앞 결제 100원 = 정가 인상(to_full) → 동의 없으면 보류, 있으면 통과.
  const g = pr.priceRiseGate({ trial: { cheap_remaining: 0, half_remaining: 0 }, lastPaidPhase: 'cheap', consents: [] })
  assert.deepEqual([g.hold, g.rise], [true, 'to_full'], '도장을 취소한 서포터즈의 정가 결제가 동의 없이 나간다')
  const ok = pr.priceRiseGate({
    trial: { cheap_remaining: 0, half_remaining: 0 },
    lastPaidPhase: 'cheap',
    consents: [{ id: 'c', rise: 'to_full', consented_on: '2026-10-15', channel: 'kakao', memo: '', revoked_at: null }],
  })
  assert.equal(ok.hold, false, '정가 동의를 기록해도 보류한다')
  // 결제일은 정상 규칙(조리 직전 토요일) — 행을 지우던 때와 같다.
  assert.equal(ss.chargeTimingFor({ cheap_remaining: 0, half_remaining: 0 }), 'before_cooking')

  // ③ 일정표·다가오는 결제 — 첫 회차가 정가 인상·보류 예정, 결제일 = 발송 3일 전 토요일, 그 뒤는 동의 전엔 없다.
  const rounds = cp.projectUserRounds({
    subs: [{ id: 's', next_delivery_date: '2026-10-20', total_amount: 51500 }],
    trial: { ...SUP, cheap_remaining: 0, half_remaining: 0 },
    lastPaidPhase: 'cheap',
    consents: [],
    fullPriceBySub: new Map([['s', full(51500)]]),
    fromIso: '2026-10-15',
    untilChargeIso: '2026-12-31',
    stopAtHold: true,
  })
  assert.deepEqual(
    rounds.map((r) => `${r.chargeIso}:${r.chargeAmount}:${r.rise}:${r.held}`),
    ['2026-10-17:51500:to_full:true'],
    '취소된 도장의 다음 결제가 정가 인상·보류 예정(10/17 토)으로 보이지 않는다',
  )

  // ④ 서버 — 결제 이력을 모르면 막고, soft 는 지우지 않고 바꾸며(낙관적 잠금), 지우기는 그 뒤에만.
  const route = code('app', 'api', 'admin', 'trials', 'route.ts')
  const del = route.slice(route.indexOf('export async function DELETE('))
  assert.match(del, /hasSupporterPricedBox\(admin, body\.userId\)/, '도장 취소가 서포터즈 가격 결제 여부를 안 본다')
  assert.match(del, /if \(supporterPaid === null\) \{\s*return NextResponse\.json\([\s\S]{0,200}status: 503/, '결제 이력을 모를 때 지운다(정가가 동의 없이 나갈 수 있다)')
  const softAt = del.indexOf("if (plan === 'soft') {")
  const deleteAt = del.indexOf('.delete()')
  assert.ok(softAt > 0 && deleteAt > softAt, '서포터즈 가격 결제가 있어도 행을 지운다')
  const soft = del.slice(softAt, deleteAt)
  assert.match(soft, /\.update\(patch\)[\s\S]{0,200}\.is\('cancelled_at', null\)[\s\S]{0,120}\.eq\('cheap_remaining', row\.cheap_remaining\)/, '취소 기록이 낙관적 잠금 없이 쓴다')
  assert.match(soft, /return NextResponse\.json\(\{ ok: true, mode: 'soft' \}\)/, 'soft 취소 뒤 지우기로 이어진다')
  const post = route.slice(route.indexOf('export async function POST('), route.indexOf('export async function DELETE('))
  assert.match(post, /if \(body\.restore === true\) \{[\s\S]*restorePatch\(row\)[\s\S]*\.not\('cancelled_at', 'is', null\)[\s\S]*action: 'trial_restamp'/, '다시 찍기가 취소 때 남은 회차로 되살리지 않거나 작업 기록이 없다')
  const hist = fnBody(code('lib', 'payments', 'customer-history.ts'), 'export async function hasSupporterPricedBox(')
  assert.match(hist, /\.not\('subscription_id', 'is', null\)\s*\.in\('discount_reason', \['trial_cheap', 'trial_half'\]\)\s*\.in\('payment_status', \[\.\.\.PAID_STATUSES\]\)/, '서포터즈 가격 결제 판정이 인상 판정의 앞 회차 기준과 다르다')
  assert.match(hist, /if \(error\) return null/, '조회 실패를 "결제 없음"으로 접는다(지워 버린다)')

  // ⑤ 화면 — 취소된 사람이 남아 동의를 기록할 수 있고, 다시 찍기가 있다.
  const client = code('app', 'admin', 'trials', 'TrialsClient.tsx')
  assert.match(client, /isTrialCancelled\(t\)\) return <Badge tone="amber">도장 취소됨/, '취소된 도장이 화면에서 구분되지 않는다')
  assert.match(client, /body: JSON\.stringify\(\{ userId: t\.user_id, restore: true \}\)/, "'도장 다시 찍기'가 없다")
  assert.match(client, /cancelled \? \([\s\S]{0,200}도장 다시 찍기[\s\S]{0,200}\) : \([\s\S]{0,200}도장 취소/, '취소된 도장에 다시 찍기 대신 취소 단추가 보인다')
})

test('규칙261: 서포터즈 회차 되돌림은 발송 전 박스의 환불만 — 배송 횟수 되돌림과 같은 조건, 취소된 도장은 보관 회차에, 도장 회수는 그대로', () => {
  const mig = read('supabase', 'migrations', '20261015100100_restore_trial_round_unshipped_only.sql')
  const fn = mig.slice(mig.indexOf('create or replace function public.tg_orders_restore_trial_round()'), mig.indexOf('-- 자기 검증'))
  const cond = fn.slice(fn.indexOf('if tg_op'), fn.indexOf('then'))
  assert.match(cond, /and new\.shipped_at is null/, '배송까지 끝난 서포터즈 박스를 전액 환불하면 100원 회차가 하나 더 생긴다')
  for (const keep of ['old.trial_round_consumed_at is not null', 'new.trial_round_restored_at is null', "new.discount_reason in ('trial_cheap', 'trial_half')"]) {
    assert.ok(cond.includes(keep), `운영 정의의 조건(${keep})이 빠졌다`)
  }
  assert.match(fn, /security definer\s+set search_path = public/, '보안 정의자·search_path 가 운영 정의와 다르다')
  assert.match(fn, /set cheap_remaining = cheap_remaining \+ 1\s+where user_id = new\.user_id\s+and cancelled_at is null/, '취소된 도장(남은 회차 0 고정)에 회차를 더한다 — 모양 제약 위반으로 환불이 실패한다')
  assert.match(fn, /set cancelled_cheap_remaining = cancelled_cheap_remaining \+ 1\s+where user_id = new\.user_id\s+and cancelled_at is not null/, '취소된 도장의 발송 전 환불 회차를 보관하지 않는다')
  assert.match(mig, /raise exception '20261015100000\(subscription_trials\.cancelled_at\)을 먼저 적용할 것/, '적용 순서 가드가 없다')
  assert.match(mig, /v_def not like '%new\.shipped_at is null%'/, '자기 검증이 발송 전 조건을 확인하지 않는다')
  assert.ok(!/tg_orders_stamp/.test(stripComments(mig.replace(/--[^\n]*/g, ''))), '도장 회수(tg_orders_stamp)를 바꿨다 — 사장님 결정 사항')
  // 환불 패널 — 배송 끝난 서포터즈 박스는 회차가 돌아오지 않는다고 말한다.
  const panel = code('app', 'admin', 'orders', '[id]', 'PartialCancelPanel.tsx')
  assert.match(panel, /supporterBox === 'shipped' && \([\s\S]{0,300}회차는 돌아오지 않아요/, '환불 패널이 배송 끝난 서포터즈 박스 환불의 결과를 말하지 않는다')
  const page = read('app', 'admin', 'orders', '[id]', 'page.tsx')
  assert.match(page, /order\.trial_round_consumed_at\s*\?\s*order\.shipped_at\s*\?\s*'shipped'\s*:\s*'unshipped'/, '환불 패널에 발송 여부를 넘기지 않는다')
})

test('규칙262: 열린 청구 보류는 해지·정지·발송일 변경·동의 기록이면 닫는다 — 판정 하나(staleHoldReason)를 청구 크론 정리와 자동결제 이력이 같이 쓴다', async () => {
  const pr = await load<PR>('lib', 'payments', 'price-rise.ts')
  const hold = { ship_date: '2026-12-01' }
  const held = { hold: true as const, rise: 'to_half' as const, phase: 'half' as const }
  const pass = { hold: false as const, rise: 'to_half' as const, phase: 'half' as const }
  const cases: Array<[string, Parameters<PR['staleHoldReason']>[0], string | null]> = [
    ['해지', { hold, sub: { status: 'cancelled', next_delivery_date: null }, gate: held }, 'cancelled'],
    ['일시정지', { hold, sub: { status: 'paused', next_delivery_date: '2026-12-01' }, gate: held }, 'paused'],
    ['미루기·발송일 변경', { hold, sub: { status: 'active', next_delivery_date: '2026-12-15' }, gate: held }, 'rescheduled'],
    ['동의 기록', { hold, sub: { status: 'active', next_delivery_date: '2026-12-01' }, gate: pass }, 'no_longer_held'],
    ['아직 보류', { hold, sub: { status: 'active', next_delivery_date: '2026-12-01' }, gate: held }, null],
    ['판정 모름', { hold, sub: { status: 'active', next_delivery_date: '2026-12-01' }, gate: null }, null],
  ]
  for (const [name, input, want] of cases) assert.equal(pr.staleHoldReason(input), want, `${name}: 보류 정리 판정이 다르다`)

  const mig = read('supabase', 'migrations', '20261015100200_charge_holds_close_reasons.sql')
  assert.match(mig, /resolved_reason in \('charged', 'cancelled', 'manual', 'paused', 'rescheduled', 'no_longer_held'\)/, '닫는 이유 제약에 새 이유가 없다(정리가 거절된다)')
  assert.match(mig, /check \(\(resolved_at is null\) = \(resolved_reason is null\)\)/, '닫힘 시각·이유 짝 제약이 없다')

  const ctx = fnBody(code('lib', 'payments', 'price-rise-context.ts'), 'export async function sweepStaleHolds(')
  assert.match(ctx, /staleHoldReason\(\{ hold: h, sub, gate \}\)/, '정리가 판정 정본(staleHoldReason)을 안 쓴다')
  assert.match(ctx, /\.update\(\{ resolved_at: nowIso, resolved_reason: reason \}\)\s*\.in\('id', ids\)\s*\.is\('resolved_at', null\)/, '정리가 열린 보류만, 이유와 함께 닫지 않는다')
  assert.match(ctx, /if \(holdsErr\) return \{ ok: false/, '보류 조회 실패를 "보류 없음"으로 접는다')

  const cron = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  const loopEnd = cron.indexOf('await new Promise((r) => setTimeout(r, 100))')
  const sweepAt = cron.indexOf('await sweepStaleHolds(supabase)')
  assert.ok(loopEnd > 0 && sweepAt > loopEnd, '청구 크론이 끝에 열린 보류를 정리하지 않는다')
  assert.match(cron, /holdsClosed,/, '크론 결과에 닫은 보류 수가 없다')
  assert.ok(read('lib', 'cron-tracking.ts').includes("'holdsClosed'"), 'cron_health 요약 허용 목록에 holdsClosed 가 없다(잘려 나간다)')
  // 청구 성공 → 도장 여부와 상관없이 닫는다(그 사이 도장이 지워진 사람의 '보내지 마세요'가 남지 않게).
  const success = cron.slice(cron.indexOf('if (postOk) {'), cron.indexOf('resolvePriceRiseHolds(supabase, sub.id)'))
  assert.ok(success.length > 0 && !success.includes('timingByUser.has'), '청구 성공 뒤 보류 닫기가 아직 도장 있는 사람에게만이다')

  // 자동결제 이력 — 같은 판정으로 '정리 예정'을 '보내지 마세요' 무리에서 뺀다.
  const page = code('app', 'admin', 'subscriptions', 'charges', 'page.tsx')
  assert.match(page, /\.select\('id, dog_id, status, next_delivery_date'\)/, '보류 화면이 구독 상태·발송일을 안 읽는다')
  assert.match(page, /staleHoldReason\(\{/, '보류 화면이 정리 판정을 안 쓴다')
  const view = code('app', 'admin', 'subscriptions', 'charges', 'ChargeRowsView.tsx')
  assert.match(view, /const live = holds\.filter\(\(h\) => !h\.stale\)/, "정리 예정 보류가 '박스 보내지 마세요' 무리에 섞인다")
})

test('규칙263: 보류 기록·닫기·정리·동의 조회 실패가 경보함에 오른다(Sentry 메일은 사장님께 안 온다)', async () => {
  const k = await load<typeof import('./admin/alert-kinds.ts')>('lib', 'admin', 'alert-kinds.ts')
  for (const n of [
    'subscription.charge.hold_record_failed',
    'subscription.charge.hold_resolve_failed',
    'subscription.charge.hold_sweep_failed',
    'subscription.charge.price_rise_lookup_failed',
  ]) {
    assert.ok(k.isOwnerAlertKind(n), `경보함 목록에 ${n} 이 없다`)
    assert.equal(k.ownerAlertDef(n)?.group, 'trial', `${n} 이 서포터즈 묶음이 아니다`)
  }
  // 닫기 실패는 warning 으로 올라온다 — warning 도 적어야 한다.
  assert.equal(k.shouldRecordOwnerAlert('warning', 'subscription.charge.hold_resolve_failed'), true, '보류 닫기 실패(warning)를 경보함에 안 적는다')
  const cron = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  for (const n of ['hold_record_failed', 'hold_resolve_failed', 'hold_sweep_failed', 'price_rise_lookup_failed']) {
    assert.ok(cron.includes(`'subscription.charge.${n}'`), `청구 크론이 ${n} 을 보내지 않는다(이름이 다르면 영영 안 쌓인다)`)
  }
  const v = await load<typeof import('./admin/alert-view.ts')>('lib', 'admin', 'alert-view.ts')
  const row = {
    id: 'a', kind: 'subscription.charge.hold_record_failed', severity: 'error', message: 'm', occurrences: 1,
    first_seen_at: '', last_seen_at: '', resolved_at: null, resolved_note: null,
    order_id: null, subscription_id: null, user_id: null, dog_id: null, context: {},
  }
  const hrefs = v.toAlertView(row, { userBySub: new Map(), userByDog: new Map() }).links.map((l) => l.href)
  assert.ok(hrefs.includes('/admin/trials') && hrefs.includes('/admin/subscriptions/charges'), '보류 경보에서 체험단·자동결제 이력으로 바로 못 간다')
})

test('규칙264: 달력 칸·그날 목록·구독 목록이 인상 동의 보류와 실제 금액을 안다 — 체험단 화면과 같은 정본 펼치기', async () => {
  const cp = await load<CP>('lib', 'payments', 'charge-projection.ts')
  // 서포터즈(100원 3·반값 4 남음, 동의 0건): 12/1 반값 첫 회 보류 예정 · 그 뒤 회차 없음(달력에 12/15·12/29 칸이 생기면 안 된다).
  const rs = cp.projectUserRounds({
    subs: [{ id: 's', next_delivery_date: '2026-10-20', total_amount: 51500 }],
    trial: SUP,
    lastPaidPhase: 'cheap',
    consents: [],
    fullPriceBySub: new Map([['s', full(51500)]]),
    fromIso: '2026-10-15',
    untilChargeIso: '2026-12-31',
    stopAtHold: true,
  })
  assert.deepEqual(rs.map((r) => `${r.shipIso}:${r.held}`), ['2026-10-20:false', '2026-11-03:false', '2026-11-17:false', '2026-12-01:true'])

  const cal = code('app', 'admin', 'subscriptions', 'calendar', 'page.tsx')
  assert.match(cal, /if \(chargeable && !upcomingError\) \{[\s\S]{0,300}for \(const r of roundsBySub\.get\(s\.id\) \?\? \[\]\)/, '달력 칸이 아직 next_delivery_date 부터 14일씩 그냥 늘린다(보류를 모른다)')
  assert.match(cal, /box: r\.held \? 'held' : 'pending'/, "달력 칸에 '보류 예정'이 없다")
  assert.ok(cal.indexOf('loadUpcomingCharges(') < cal.indexOf('for (const s of subList) {\n    if (!s.next_delivery_date) continue'), '달력 칸을 그린 뒤에야 실제 회차를 불러온다')
  const dayList = cal.slice(cal.indexOf('id="day-detail"'))
  assert.match(dayList, /\{amountText\(it\)\}/, "'그날 전체' 목록 금액이 아직 정가(total_amount)다")
  assert.ok(!/\(it\.total_amount \?\? 0\)\.toLocaleString\(\)\}원/.test(dayList), "'그날 전체' 목록이 정가를 그대로 그린다")

  const route = code('app', 'api', 'admin', 'trials', 'route.ts')
  const get = route.slice(route.indexOf('export async function GET('), route.indexOf('export async function POST('))
  assert.match(get, /params\.get\('rounds'\) === '1'[\s\S]*loadChargeProjection\([\s\S]*stopAtHold: true/, '구독 목록용 다음 결제 회차가 정본 펼치기(보류에서 멈춤)가 아니다')
  assert.match(get, /\.eq\('status', 'active'\)\s*\.eq\('requires_billing_key_renewal', false\)\s*\.not\('billing_key', 'is', null\)/, '다음 결제 회차 대상이 청구 크론 조건과 다르다')
  const list = code('app', 'admin', 'subscriptions', 'page.tsx')
  assert.match(list, /fetch\('\/api\/admin\/trials\?rounds=1'\)/, '구독 목록이 다음 결제 회차를 안 받는다')
  assert.match(list, /const heldHere = !!round\?\.held/, "구독 목록이 '인상 동의 없음 — 보류 예정'을 모른다")
  assert.match(list, /if \(round\?\.held\) \{[\s\S]{0,300}인상 동의 없음 · 보류 예정/, '구독 목록 금액 칸이 보류 예정을 말하지 않는다')
  assert.equal(
    (list.match(/<RoundAmount sub=\{sub\} supporter=\{supporter\} round=\{round\}><AmountCell sub=\{sub\} supporter=\{supporter\} \/><\/RoundAmount>/g) ?? []).length,
    2,
    '구독 목록(넓은 화면·폰) 금액 칸이 다음 결제 회차(보류·실제 금액)를 안 본다',
  )
  assert.match(list, /round=\{nextRounds\.get\(sub\.id\) \?\? null\}/, '구독 목록 줄에 다음 결제 회차를 넘기지 않는다')
})

test('규칙265: 자동결제 이력 요약 숫자는 사장님 시험 계정을 뺀다 — 홈과 같은 정본, 목록은 그대로, 못 뺐으면 말한다', async () => {
  const ia = await load<typeof import('./admin/internal-accounts.ts')>('lib', 'admin', 'internal-accounts.ts')
  const id = 'f64d1e3f-0000-4000-8000-000000000000'
  assert.equal(ia.excludeInternalFilter(new Set([id])), `user_id.is.null,user_id.not.in.(${id})`)
  const page = code('app', 'admin', 'subscriptions', 'charges', 'page.tsx')
  assert.match(page, /const internal = await loadInternalUserIds\(createAdminClient\(\)\)/, '시험 계정을 정본(admin_user_ids, service_role)으로 안 읽는다')
  assert.match(page, /return userFilter \? base\.or\(userFilter\) : base/, '요약 집계에 시험 계정 제외 필터가 없다')
  assert.match(page, /statsQuery\(\)\.eq\('scheduled_for', today\)/, "'오늘 시도'에 시험 계정이 섞인다")
  assert.match(page, /statsQuery\(\)\.gte\('attempted_at', thirtyDaysAgo\)/, "'30일 성공률·누적 매출'에 시험 계정이 섞인다")
  const listQ = page.slice(page.indexOf('const listQuery = () => {'), page.indexOf('const internal ='))
  assert.ok(!listQ.includes('userFilter'), '처리할 목록에서까지 시험 계정을 뺀다(시험 결제 실패도 손이 필요하다)')
  assert.match(page, /internal\.ok \? \([\s\S]{0,200}시험 계정을 뺀 값/, '시험 계정을 뺐다는 한 줄이 없다')
  assert.match(page, /시험 계정을 확인하지 못해/, '시험 계정을 못 뺐을 때 말하지 않는다(규칙1)')
})

test('규칙266: 알레르기·건강 강제 제안 3일 무응답 — 손님에게 "그대로 적용" 거짓 안내 금지 · 경보함 "연락 필요" · 마감 목록에 표시 · 결제는 그대로', async () => {
  const d = await load<typeof import('./personalization/approval-deadline.ts')>('lib', 'personalization', 'approval-deadline.ts')
  const at = '2026-10-10T00:00:00.000Z'
  const forced = { priceChange: { from: 51500, to: 56000, forced: true } }
  const weight = { priceChange: { from: 51500, to: 56000, forced: false } }
  assert.equal(d.isForcedProposal(forced), true)
  assert.equal(d.isForcedProposal(weight), false)
  assert.equal(d.isForcedProposal({ needsConsultation: true }), false)
  // 마감은 그대로 3일(손님 화면 약속·승인 금액이 어긋난 제안은 닫혀야 다시 만들어진다).
  assert.equal(d.approvalExpired({ proposed_at: at, formula: forced }, new Date('2026-10-13T00:00:00Z')), true)
  const left = d.approvalTimeLeft({ proposed_at: at, formula: forced }, new Date('2026-10-12T00:00:00Z'))
  assert.match(left?.label ?? '', /알레르기·건강 제안 — 답이 없으면 연락 필요/, '마감 임박 목록에서 알레르기·건강 제안이 구분되지 않는다')
  assert.ok(!/알레르기/.test(d.approvalTimeLeft({ proposed_at: at, formula: weight }, new Date('2026-10-12T00:00:00Z'))?.label ?? ''), '몸무게 제안까지 알레르기 표시가 붙는다')

  const cron = code('app', 'api', 'cron', 'personalization-approval-timeout', 'route.ts')
  assert.match(cron, /const forced = isForcedProposal\(row\.formula\)/, '마감 크론이 알레르기·건강 제안을 가르지 않는다')
  assert.match(cron, /if \(forced\) \{\s*forcedNoReply \+= 1\s*captureBusinessEvent\('error', 'personalization\.approval_timeout\.forced_no_reply'/, '알레르기 제안 무응답을 경보함에 올리지 않는다')
  const pushAt = cron.indexOf('await pushToUser(')
  const forcedPush = cron.slice(pushAt, cron.indexOf(': {', pushAt))
  assert.ok(forcedPush.includes('forced'), '손님 푸시가 알레르기 제안을 가르지 않는다')
  assert.ok(!/그대로/.test(forcedPush), "알레르기 제안 무응답 손님 푸시가 아직 '그대로 적용'이라고 말한다")
  assert.match(forcedPush, /따로 연락드릴게요/, '알레르기 제안 무응답 푸시가 다음에 무엇이 일어나는지 말하지 않는다')
  const mailAt = cron.indexOf('notifyPersonalizationKeptPrevious')
  const skipAt = cron.indexOf('if (forced) continue')
  assert.ok(skipAt > pushAt && skipAt < mailAt, "알레르기 제안에 '그대로 유지' 메일이 나간다")
  // 결제 동작은 바꾸지 않는다(사장님 결정) — 마감 크론이 구독·금액을 건드리지 않는다.
  assert.ok(!/from\('subscriptions'\)/.test(cron), '마감 크론이 구독(결제)을 바꾼다 — 사장님 결정 사항')
  const k = await load<typeof import('./admin/alert-kinds.ts')>('lib', 'admin', 'alert-kinds.ts')
  assert.equal(k.ownerAlertDef('personalization.approval_timeout.forced_no_reply')?.group, 'recipe')
})

test('규칙267: 크론 실패 — 경보함(크론 + KST 날짜로 묶어 처리함까지 남음) · Sentry 크론별 묶음·태그', async () => {
  const ev = await load<typeof import('./sentry/cron-event.ts')>('lib', 'sentry', 'cron-event.ts')
  const k = await load<typeof import('./admin/alert-kinds.ts')>('lib', 'admin', 'alert-kinds.ts')
  assert.equal(k.shouldRecordOwnerAlert('error', 'cron.error'), true, '크론 실패가 경보함에 안 들어간다')
  // KST 날짜 — 10/14 23:30 UTC = 10/15 08:30 KST.
  const key = ev.cronAlertTargetKey('subscription-charge', new Date('2026-10-14T23:30:00Z'))
  assert.equal(key, 'cron:subscription-charge:2026-10-15', '크론 경보 묶음 열쇠가 크론 + KST 날짜가 아니다')
  assert.notEqual(key, ev.cronAlertTargetKey('tracking-poll', new Date('2026-10-14T23:30:00Z')), '다른 크론의 실패가 한 줄로 묶인다')
  assert.notEqual(key, ev.cronAlertTargetKey('subscription-charge', new Date('2026-10-15T23:30:00Z')), '다음 날 실패가 어제 줄에 묻힌다')
  assert.equal(k.alertTargetKey('cron.error', { targetKey: key, cron_path: 'subscription-charge' }), key)
  assert.notDeepEqual(ev.cronSentryFingerprint('subscription-charge'), ev.cronSentryFingerprint('tracking-poll'), '모든 크론 실패가 Sentry 이슈 하나로 묶인다')

  const tracking = code('lib', 'cron-tracking.ts')
  const notify = tracking.slice(tracking.indexOf('async function notifyCronError('))
  assert.match(notify, /targetKey: cronAlertTargetKey\(path, new Date\(\)\)/, '크론 실패 경보에 묶음 열쇠가 없다')
  assert.match(notify, /\{ fingerprint: cronSentryFingerprint\(path\), tags: \{ 'cron\.path': path \} \}/, '크론 실패 Sentry 이벤트에 크론별 묶음·태그가 없다')
  const trace = code('lib', 'sentry', 'trace.ts')
  const cap = trace.slice(trace.indexOf('export function captureBusinessEvent('))
  assert.match(cap, /tags: \{ 'business\.event': '1', \.\.\.opts\?\.tags \}/, 'captureBusinessEvent 가 태그를 넘기지 않는다')
  assert.match(cap, /\.\.\.\(opts\?\.fingerprint \? \{ fingerprint: opts\.fingerprint \} : \{\}\)/, 'captureBusinessEvent 가 Sentry 묶음(fingerprint)을 넘기지 않는다')
  const v = await load<typeof import('./admin/alert-view.ts')>('lib', 'admin', 'alert-view.ts')
  const links = v.toAlertView(
    {
      id: 'a', kind: 'cron.error', severity: 'error', message: 'm', occurrences: 1, first_seen_at: '', last_seen_at: '',
      resolved_at: null, resolved_note: null, order_id: null, subscription_id: null, user_id: null, dog_id: null, context: {},
    },
    { userBySub: new Map(), userByDog: new Map() },
  ).links
  assert.ok(links.some((l) => l.href === '/admin/cron-health'), '크론 실패 경보에서 자동작업 화면으로 못 간다')
  assert.ok(existsSync(join(ROOT, 'app', 'admin', 'cron-health', 'page.tsx')), '자동작업 화면 경로가 바뀌었다')
})

test('규칙268: 09:10 정기결제 자동작업이 안 돌면 같은 날 09:40 아침 알림에 잡힌다(워치독 창 끝 = 지금 − 20분)', async () => {
  const w = await load<typeof import('./cron-watchdog.ts')>('lib', 'cron-watchdog.ts')
  const br = code('app', 'api', 'cron', 'daily-briefing', 'route.ts')
  const m = br.match(/const windowEnd = new Date\(Date\.now\(\) - (\d+) \* 60 \* 1000\)/)
  assert.ok(m, '아침 알림 워치독 창 끝 계산을 못 찾았다')
  const graceMin = Number(m![1])
  const crons = (JSON.parse(read('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons
  // 화 10/20 09:40 KST(00:40 UTC) — 그날 09:10 정기결제만 빼고 지난 이틀 모든 실행 기록이 있다.
  const now = new Date('2026-10-20T00:40:30Z')
  const records: Array<{ path: string; executed_at: string }> = []
  for (const c of crons) {
    const name = c.path.split('/').pop()!
    for (const inst of w.expectedRunsInWindow(c.schedule, new Date(now.getTime() - 48 * 3600_000), now)) {
      if (name === 'subscription-charge' && inst.toISOString() === '2026-10-20T00:10:00.000Z') continue
      records.push({ path: name, executed_at: new Date(inst.getTime() + 40_000).toISOString() })
    }
  }
  const end = new Date(now.getTime() - graceMin * 60_000)
  const missed = w.findMissedCrons(crons, records, new Date(end.getTime() - 24 * 3600_000), end)
  assert.deepEqual(missed, ['subscription-charge'], `09:10 정기결제가 안 돌았는데 같은 날 아침 알림에 안 잡힌다(창 끝 −${graceMin}분)`)
  // 다 돌았으면 아무것도 안 뜬다(오탐 없음 — 브리핑 자신도).
  const all = [...records, { path: 'subscription-charge', executed_at: '2026-10-20T00:10:40.000Z' }]
  assert.deepEqual(w.findMissedCrons(crons, all, new Date(end.getTime() - 24 * 3600_000), end), [], '다 돌았는데 안 돈 자동작업이 뜬다')
})

test('규칙269: 체험단 화면 — 동의 기록·취소 실패와 인터넷 끊김이 누른 그 고객 카드 안에 보인다(폰 운영)', () => {
  const c = code('app', 'admin', 'trials', 'TrialsClient.tsx')
  for (const fn of ['search', 'stamp', 'unstamp', 'restamp', 'recordConsent', 'revokeConsent']) {
    const at = c.indexOf(`async function ${fn}(`)
    assert.ok(at > 0, `${fn} 처리가 없다`)
    const next = c.indexOf('async function ', at + 10)
    const body = c.slice(at, next < 0 ? c.indexOf('return (', at) : next)
    assert.match(body, /\} catch \{[\s\S]{0,200}networkMessage\(\)/, `${fn}: 인터넷이 끊기면 아무 안내도 없다(catch 없음)`)
  }
  // 결과 문구는 그 카드 안 — 동의 기록 입력 칸 안(기록하기 단추 아래)과 카드 안.
  const formAt = c.indexOf('{formKey === key && !r.consent && (')
  const outsideAt = c.indexOf('{!(formKey?.startsWith(`${t.user_id}:`)) && cardNote(t.user_id)}')
  assert.ok(formAt > 0 && outsideAt > formAt, '동의 기록 입력 칸 또는 카드 안 결과 문구 자리가 없다')
  assert.match(c.slice(formAt, outsideAt), /\{cardNote\(t\.user_id\)\}/, '동의 기록 실패 문구가 입력 칸 안에 없다(폰에서 화면 밖)')
  assert.match(c, /setCardMsg\(\{ userId: t\.user_id, tone: 'error'/, '실패 문구가 누른 고객 카드에 붙지 않는다')
  assert.match(c, /role="alert"/, '실패 문구를 알림으로 읽어 주지 않는다')
  assert.match(c, /window\.addEventListener\('offline', sync\)/, '인터넷이 끊긴 것을 화면이 모른다')
  assert.match(c, /인터넷이 끊겨 있어요/, '인터넷 끊김 안내가 없다')
})
