/**
 * 2026-10-14 어드민 강화 갈래 A '돈·서포터즈' 의 규칙 241~246 (가지 feat/admin-a-money).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드
 * (32d1ea8c)에서는 빨간불, 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 *   241 A1 DB — 인상 동의 기록·청구 보류 표: RLS 켬, 고객 쓰기 없음, 관리자 읽기, 자기 검증, 타입
 *   242 A1 청구 크론 — 가격이 오르는 회차인데 그 인상의 동의 기록이 없으면 청구하지 않고 보류(6명 실제 일정 시뮬레이션)
 *   243 A1 포장 목록 — 보류될 박스는 발송 금지(ship-block 사유, 포장 목록이 같은 판정을 넣는다)
 *   244 A1 어드민 체험단 — 회차 일정표·가격 전환일·동의 상태(30일 전 빨강)·동의 기록/취소(관리자 확인·작업 기록·확인창)
 *   245 A2 자동결제 이력 — 실패·보류·결과 불명 행에 고객·강아지·카드 끝 4자리·쉬운 말 사유·재시도·고객 보기, '실패만 보기'
 *   246 A2 다가오는 결제·포장 목록 금액 — 실제 나갈 금액(100원은 100원)과 정가, 합계는 실제 금액, 결제액/결제 예정액
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

type PR = typeof import('./payments/price-rise.ts')
type TR = typeof import('./payments/trial.ts')
type SS = typeof import('./shipping-schedule.ts')
type CP = typeof import('./payments/charge-projection.ts')
type DK = typeof import('./datetime-kst.ts')

/** 서포터즈 6명의 실제 구독가(2026-10-14 운영 DB SELECT — 이름 없이 금액만). 모두 100원 3회·반값 4회 남음, 다음 발송 10/20. */
const SUPPORTER_SUBTOTALS = [51500, 90000, 31500, 112600, 105700, 32200] as const

type SimTrial = { cheap_remaining: number; half_remaining: number; cheap_price: number; half_rate: number }
type SimSub = {
  subtotal: number
  next: string
  trial: SimTrial | null
  lastPaidPhase: 'cheap' | 'half' | 'full' | null
  consents: Array<{ id: string; rise: string; consented_on: string; channel: string; memo: string; revoked_at: string | null }>
  charges: Array<{ day: string; ship: string; amount: number; phase: string }>
  holds: string[]
}

/**
 * 청구 크론의 한 구독 처리를 정본 함수로 그대로 따라 한다(app/api/cron/subscription-charge):
 *   결제일 판정(chargeTimingFor·chargeDateFor) → 인상 동의 게이트(priceRiseGate) → 금액(resolveAutoDiscount 의 체험 구간 =
 *   trialPricing, 서포터즈 6명은 등급 없음이라 정가 구간 = 구독가) → 회차 차감 → 다음 발송일(nextChargeDateAfterSuccess,
 *   크론의 nextDeliveryDate). 보류면 아무것도 바꾸지 않는다(발송일·회차 그대로).
 */
function cronDay(m: { pr: PR; tr: TR; ss: SS }, sub: SimSub, today: string): 'not_due' | 'held' | 'charged' {
  const timing = m.ss.chargeTimingFor(sub.trial)
  if (m.ss.chargeDateFor(sub.next, timing) > today) return 'not_due'
  const gate = m.pr.priceRiseGate({ trial: sub.trial, lastPaidPhase: sub.lastPaidPhase, consents: sub.consents })
  if (gate.hold) {
    if (!sub.holds.includes(sub.next)) sub.holds.push(sub.next)
    return 'held'
  }
  const tp = m.tr.trialPricing(sub.trial, sub.subtotal)
  const amount = tp ? tp.chargeAmount : sub.subtotal
  const phase = m.pr.phaseOf(sub.trial) ?? 'full'
  if (sub.trial && tp) {
    sub.trial =
      tp.phase === 'cheap'
        ? { ...sub.trial, cheap_remaining: sub.trial.cheap_remaining - 1 }
        : { ...sub.trial, half_remaining: sub.trial.half_remaining - 1 }
  }
  sub.charges.push({ day: today, ship: sub.next, amount, phase })
  sub.lastPaidPhase = phase
  sub.next = m.ss.nextChargeDateAfterSuccess(sub.next, today, timing)
  return 'charged'
}

function supporter(subtotal: number, consents: SimSub['consents'] = []): SimSub {
  return {
    subtotal,
    next: '2026-10-20',
    trial: { cheap_remaining: 3, half_remaining: 4, cheap_price: 100, half_rate: 0.5 },
    // 10/6 에 100원 1회 결제됨(운영 실측) — 앞 회차 = 100원 구간.
    lastPaidPhase: 'cheap',
    consents,
    charges: [],
    holds: [],
  }
}

const CONSENT_HALF = { id: 'c1', rise: 'to_half', consented_on: '2026-11-20', channel: 'instagram_dm', memo: '', revoked_at: null }
const CONSENT_FULL = { id: 'c2', rise: 'to_full', consented_on: '2027-01-02', channel: 'kakao', memo: '', revoked_at: null }

// ─────────────────────────────────────────────────────────────────────────────

test('규칙241: 인상 동의 기록·청구 보류 표 — RLS 켬, 고객(anon·authenticated) 쓰기 없음, 관리자 읽기(is_admin), 쓰기는 서버, 자기 검증 (A1)', () => {
  /**
   * # 왜 (2026-10-14 사장님 '필수')
   * 서포터즈 가격이 100원 → 반값 → 정가로 오르는데 고객 동의를 받았는지가 어디에도 없었다. 동의 기록은 돈이 나가게 하는
   * 스위치이고(청구 크론이 이걸 본다), 보류 기록은 운영 브리핑·포장 목록이 읽는다 — 고객이 쓸 수 있으면 스스로 동의를
   * 만들거나 보류를 지울 수 있다.
   */
  const migs = readdirSync(join(ROOT, 'supabase', 'migrations'))
  const consentMig = migs.find((f) => /^2026101420\d{4}_subscription_price_consents\.sql$/.test(f))
  const holdMig = migs.find((f) => /^2026101420\d{4}_subscription_charge_holds\.sql$/.test(f))
  assert.ok(consentMig, '인상 동의 기록 표 마이그레이션(2026101420xxxx_subscription_price_consents.sql)이 없다')
  assert.ok(holdMig, '청구 보류 표 마이그레이션(2026101420xxxx_subscription_charge_holds.sql)이 없다')
  for (const [f, table] of [
    [consentMig!, 'subscription_price_consents'],
    [holdMig!, 'subscription_charge_holds'],
  ] as const) {
    const sql = read('supabase', 'migrations', f)
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table}: RLS 를 켜지 않는다`)
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`), `${table}: 고객 권한을 회수하지 않는다`)
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated`), `${table}: 관리자 읽기용 SELECT 권한이 없다`)
    assert.ok(!new RegExp(`grant (insert|update|delete|all)[^;]*on table public\\.${table} to (anon|authenticated)`).test(sql), `${table}: 고객에게 쓰기 권한을 준다`)
    assert.match(sql, /for select to authenticated\s*using \(public\.is_admin\(\)\)/, `${table}: 읽기 정책이 관리자(is_admin) 전용이 아니다`)
    assert.match(sql, new RegExp(`grant all on table public\\.${table} to service_role`), `${table}: 서버(service_role) 쓰기 권한이 없다`)
    // 자기 검증 블록 — 적용하는 순간 권한이 틀렸으면 실패한다.
    assert.match(sql, /do \$\$[\s\S]*has_table_privilege\('authenticated', 'public\.[a-z_]+', 'insert'\)[\s\S]*raise exception/, `${table}: 자기 검증 블록이 없다`)
    assert.match(sql, /relrowsecurity/, `${table}: 자기 검증이 RLS 켜짐을 확인하지 않는다`)
  }
  const c = read('supabase', 'migrations', consentMig!)
  assert.match(c, /rise text not null check \(rise in \('to_half', 'to_full'\)\)/, '어느 인상인지(100원→반값 / 반값→정가) 칸이 없다')
  for (const col of ['consented_on date not null', 'channel text not null', 'memo text', 'recorded_by uuid', 'revoked_at timestamptz', 'revoked_by uuid']) {
    assert.ok(c.includes(col), `동의 기록에 '${col}' 칸이 없다 — 언제·경로·메모·기록자·취소를 남겨야 한다`)
  }
  assert.match(c, /create unique index if not exists \w+\s+on public\.subscription_price_consents \(user_id, rise\)\s+where revoked_at is null/, '한 사람·한 인상의 유효한 기록이 하나로 묶이지 않는다')
  // 새 표를 고른 이유가 파일에 있다(누가 판단해도 되게).
  assert.match(c, /왜 subscription_trials 의 칸이 아니라 새 표인가/, '새 표를 고른 이유가 주석에 없다')
  const h = read('supabase', 'migrations', holdMig!)
  assert.match(h, /create unique index if not exists \w+\s+on public\.subscription_charge_holds \(subscription_id, ship_date, reason\)\s+where resolved_at is null/, '열린 보류가 구독·발송일마다 하나로 묶이지 않는다')
  // 타입.
  const types = read('lib', 'supabase', 'types.ts')
  assert.match(types, /subscription_price_consents: \{\s*Row: \{/, 'types.ts 에 동의 기록 표가 없다')
  assert.match(types, /subscription_charge_holds: \{\s*Row: \{/, 'types.ts 에 보류 표가 없다')
})

test('규칙242: 청구 크론 — 가격이 오르는 회차(100원→반값 첫 회·반값→정가 첫 회)는 그 인상의 동의 기록이 없으면 청구하지 않고 보류한다. 6명 실제 일정 시뮬레이션 (A1)', async () => {
  /**
   * # 왜 (2026-10-14 사장님 '필수')
   * 정기결제 대금 증액은 고객 동의가 있어야 한다(전자상거래법 2025-02). 지금까지 크론은 100원 → 반값 → 정가로 그냥 넘어갔다.
   * 돈 경로라 테스트를 두껍게 — 6명의 실제 일정(10/20·11/3·11/17 100원, 12/1 반값, 2027-01-23 정가)을 정본 함수로 굴려
   * 동의 있음/없음 각각의 청구 여부·금액·남은 횟수·다음 발송일을 본다. 정상가 고객·100원 구간 회차는 영향 0.
   */
  const pr = await load<PR>('lib', 'payments', 'price-rise.ts')
  const tr = await load<TR>('lib', 'payments', 'trial.ts')
  const ss = await load<SS>('lib', 'shipping-schedule.ts')
  const dk = await load<DK>('lib', 'datetime-kst.ts')
  const m = { pr, tr, ss }
  const days: string[] = []
  for (let d = '2026-10-14'; d <= '2027-02-28'; d = dk.addDaysKst(d, 1)) days.push(d)
  const run = (subs: SimSub[], onDay?: (d: string) => void) => {
    for (const d of days) {
      onDay?.(d)
      for (const s of subs) cronDay(m, s, d)
    }
  }

  // ① 두 인상 모두 동의 기록 있음 — 10회 정상 청구, 금액·차감·발송일이 일정대로.
  const ok = SUPPORTER_SUBTOTALS.map((t) => supporter(t, [CONSENT_HALF, CONSENT_FULL]))
  run(ok)
  for (const s of ok) {
    const half = Math.max(100, s.subtotal - Math.round(s.subtotal * 0.5))
    assert.deepEqual(
      s.charges.map((c) => `${c.day}:${c.amount}`),
      [
        '2026-10-20:100',
        '2026-11-03:100',
        '2026-11-17:100',
        `2026-12-01:${half}`,
        `2026-12-15:${half}`,
        `2026-12-29:${half}`,
        `2027-01-12:${half}`,
        // 정가부터는 조리 직전 토요일 결제 — 1/26(화) 발송분을 1/23(토)에.
        `2027-01-23:${s.subtotal}`,
        `2027-02-06:${s.subtotal}`,
        `2027-02-20:${s.subtotal}`,
      ],
      `구독가 ${s.subtotal}원 서포터즈의 청구 일정이 다르다`,
    )
    assert.deepEqual(s.charges[7], { day: '2027-01-23', ship: '2027-01-26', amount: s.subtotal, phase: 'full' }, '첫 정가 결제가 1/23(토)·1/26 발송이 아니다')
    assert.deepEqual(s.trial && [s.trial.cheap_remaining, s.trial.half_remaining], [0, 0])
    assert.equal(s.next, '2027-03-09', '마지막 결제 뒤 다음 발송일이 다르다')
    assert.deepEqual(s.holds, [], '동의가 있는데 보류했다')
  }

  // ② 100원→반값 동의 없음 — 100원 3회는 그대로, 12/1 반값 첫 회부터 보류. 발송일·회차는 그대로(내일로 미루지 않는다).
  const noHalf = SUPPORTER_SUBTOTALS.map((t) => supporter(t, [CONSENT_FULL]))
  run(noHalf)
  for (const s of noHalf) {
    assert.deepEqual(s.charges.map((c) => `${c.day}:${c.amount}`), ['2026-10-20:100', '2026-11-03:100', '2026-11-17:100'], '100원 구간 회차가 막혔거나 반값이 동의 없이 나갔다')
    assert.deepEqual(s.holds, ['2026-12-01'], '반값 첫 회(12/1 발송분)가 보류되지 않았다')
    assert.equal(s.next, '2026-12-01', '보류했는데 발송일이 움직였다 — 다음 날로 미루지 말고 그 회차에 멈춰야 한다')
    assert.deepEqual(s.trial && [s.trial.cheap_remaining, s.trial.half_remaining], [0, 4], '보류했는데 회차가 줄었다')
  }

  // ③ 동의가 12/3 에 기록되면 12/4 아침 크론이 정상 청구 — 늦은 성공이라 다음 발송은 정본(nextChargeDateAfterSuccess)대로 12/22.
  const late = supporter(51500, [CONSENT_FULL])
  run([late], (d) => {
    if (d === '2026-12-04') late.consents = [...late.consents, { ...CONSENT_HALF, consented_on: '2026-12-03' }]
  })
  assert.equal(late.charges[3]?.day, '2026-12-04', '동의 기록 다음 크론에서 청구되지 않았다')
  assert.equal(late.charges[3]?.amount, 25750)
  assert.equal(late.charges[4]?.day, '2026-12-22', '늦은 청구 뒤 다음 결제일이 다르다(박스는 12/8 발송, 다음은 12/22)')
  assert.deepEqual(late.holds, ['2026-12-01'])

  // ④ 반값→정가 동의 없음 — 반값 4회까지 나가고 1/23(1/26 발송분) 정가 첫 회가 보류.
  const noFull = SUPPORTER_SUBTOTALS.map((t) => supporter(t, [CONSENT_HALF]))
  run(noFull)
  for (const s of noFull) {
    assert.equal(s.charges.length, 7, '반값 구간까지 7회가 아니다')
    assert.equal(s.charges.at(-1)?.day, '2027-01-12')
    assert.deepEqual(s.holds, ['2027-01-26'], '정가 첫 회(1/26 발송분)가 보류되지 않았다')
    assert.equal(s.next, '2027-01-26')
    assert.ok(!s.charges.some((c) => c.phase === 'full'), '동의 없이 정가가 나갔다')
  }

  // ⑤ 정상가 고객(체험 없음 — 사장님 시험 계정 3af1665b 모양): 동의 기록이 하나도 없어도 영향 0.
  const normal: SimSub = { subtotal: 32700, next: '2026-11-10', trial: null, lastPaidPhase: 'full', consents: [], charges: [], holds: [] }
  run([normal])
  assert.equal(normal.charges[0]?.day, '2026-11-07', '정상가 고객 첫 결제가 11/7(토)이 아니다')
  assert.equal(normal.charges[0]?.amount, 32700)
  assert.equal(normal.charges.length, 9)
  assert.deepEqual(normal.holds, [], '정상가 고객이 보류됐다')
  assert.deepEqual(pr.priceRiseGate({ trial: null, lastPaidPhase: 'cheap', consents: [] }), { hold: false, rise: null, phase: null })

  // ⑥ 100원 구간 회차는 어떤 앞 회차에서도 인상이 아니다 · 첫 결제는 인상이 아니다 · 정가 고객에게 반값 도장 = 인하.
  for (const prev of ['cheap', 'half', 'full', null] as const) {
    assert.equal(pr.priceRiseGate({ trial: { cheap_remaining: 2, half_remaining: 4 }, lastPaidPhase: prev, consents: [] }).hold, false, `100원 회차가 막혔다(앞 ${prev})`)
  }
  assert.equal(pr.priceRiseGate({ trial: { cheap_remaining: 0, half_remaining: 4 }, lastPaidPhase: null, consents: [] }).hold, false, '첫 결제를 인상으로 본다')
  assert.equal(pr.priceRiseGate({ trial: { cheap_remaining: 0, half_remaining: 4 }, lastPaidPhase: 'full', consents: [] }).hold, false, '정가 → 반값(인하)을 인상으로 본다')
  // 취소된 기록은 동의가 아니다.
  assert.equal(pr.priceRiseGate({ trial: { cheap_remaining: 0, half_remaining: 4 }, lastPaidPhase: 'cheap', consents: [{ ...CONSENT_HALF, revoked_at: '2026-11-21T00:00:00Z' }] }).hold, true, '취소된 동의 기록으로 청구한다')
  assert.equal(pr.phaseFromDiscountReason('trial_cheap'), 'cheap')
  assert.equal(pr.phaseFromDiscountReason('trial_half'), 'half')
  assert.equal(pr.phaseFromDiscountReason('tier'), 'full')

  // ⑦ 크론 소스 — 같은 판정을 쓰고, 청구 행·토스 청구보다 먼저, 보류 땐 아무것도 바꾸지 않고 다음 구독으로.
  const cron = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  assert.match(cron, /import \{ priceRiseGate[^}]*\} from '@\/lib\/payments\/price-rise'/, '크론이 판정 정본(priceRiseGate)을 안 쓴다')
  const gateAt = cron.indexOf('priceRiseGate({')
  const insertAt = cron.search(/\.from\('subscription_charges'\)\s*\.insert\(/)
  const tossAt = cron.indexOf('chargeBillingKey({')
  assert.ok(gateAt > 0 && insertAt > gateAt && tossAt > gateAt, '인상 동의 판정이 청구 행 생성·토스 청구보다 뒤에 있다')
  assert.match(cron, /if \(timingByUser\.has\(sub\.user_id\)\) \{\s*const riseCtx = await loadPriceRiseContext\(supabase, \[sub\.user_id\]\)/, '체험 도장이 없는 정상가 고객까지 판정·조회한다(또는 판정 상태를 안 읽는다)')
  const lookupFail = cron.slice(cron.indexOf('if (!riseCtx.ok) {'), cron.indexOf('const rc = riseCtx.byUser'))
  assert.match(lookupFail, /skipped \+= 1\s*continue/, '동의 상태 조회 실패를 "인상 아님"으로 접고 청구한다')
  const holdBranch = cron.slice(cron.indexOf('if (gate.hold) {'), cron.indexOf('priceConsentHeld += 1') + 60)
  assert.ok(holdBranch.length > 60, '보류 분기가 없다')
  assert.match(holdBranch, /recordPriceRiseHold\(supabase, \{/, '보류를 기록하지 않는다(운영 브리핑·포장 목록이 못 본다)')
  assert.match(holdBranch, /captureBusinessEvent\('error', 'subscription\.charge\.price_rise_consent_missing'/, '처음 보류할 때 사장님 알림(Sentry error)이 없다')
  assert.match(holdBranch, /priceConsentHeld \+= 1\s*continue/, '보류 뒤 청구로 이어진다')
  assert.ok(!/next_delivery_date\s*:/.test(holdBranch) && !holdBranch.includes(".from('subscriptions')"), '보류하면서 발송일을 바꾼다 — 그 회차에 멈춰야 한다')
  assert.match(cron, /if \(postOk\) \{[\s\S]{0,600}resolvePriceRiseHolds\(supabase, sub\.id\)/, '청구 성공 뒤 열린 보류를 닫지 않는다')
  assert.match(cron, /priceConsentHeld,/, '크론 결과에 보류 수가 없다')
  assert.ok(read('lib', 'cron-tracking.ts').includes("'priceConsentHeld'"), 'cron_health 요약 허용 목록에 priceConsentHeld 가 없다(잘려 나간다)')

  // ⑧ 인상 예고(마지막 할인 회차 결제 직후 메일·푸시)는 그대로 — 날짜·금액이 정본에서 온다.
  assert.match(cron, /const nextPricing = await resolveAutoDiscount\(\{\s*userId: sub\.user_id,/, '예고 금액이 청구와 같은 함수(resolveAutoDiscount)가 아니다')
  assert.match(cron, /const nextShip = nextDeliveryDate\(sub\.next_delivery_date, today, timingOf\(sub\)\)/, '예고의 다음 발송일이 크론의 다음 발송일 계산이 아니다')
  assert.match(cron, /const nextChargeDate = chargeDateFor\(nextShip,/, '예고의 결제일이 결제 시점 정본(chargeDateFor)이 아니다')
  assert.match(cron, /nextAmount: nextPricing\.chargeAmount/, '예고 메일 금액이 정본 값이 아니다')
})

test('규칙243: 포장 목록 — 인상 동의가 없어 청구가 보류될 박스는 발송 금지(ship-block price_consent_missing). 판정은 크론과 같은 함수 (A1)', async () => {
  /**
   * # 왜
   * 서포터즈는 발송일(화) 아침에 결제된다 — 주말 조리 때는 '청구 예정'으로 보여 재료를 사고 만든다. 화요일에 크론이
   * 보류하면 그 박스는 돈을 못 받는다. 미리 막고, 라벨·조리 합계·CSV 가 같은 기준(ship-block)으로 뺀다.
   */
  const sb = await load<typeof import('./admin/ship-block.ts')>('lib', 'admin', 'ship-block.ts')
  const clean = {
    cannotCharge: false,
    chargeFailedToday: false,
    pausedBeforeCharge: false,
    skippedNotCharged: false,
    overdueNotCharged: false,
    notChargedAfterRun: false,
    alreadyShipped: null,
  }
  type In = Parameters<typeof sb.shipBlockReason>[0]
  assert.equal(sb.shipBlockReason({ ...clean, priceConsentMissing: true } as In), 'price_consent_missing', '보류될 박스를 발송 가능으로 판정한다')
  assert.equal(sb.isShippable({ ...clean, priceConsentMissing: true } as In), false)
  assert.equal(sb.shipBlockReason({ ...clean, priceConsentMissing: false } as In), null, '동의가 있는 박스까지 막는다')
  // 더 근본적인 사유(카드 없음)가 먼저, '청구 지연'보다는 이 사유가 먼저(이유가 더 정확하다).
  assert.equal(sb.shipBlockReason({ ...clean, cannotCharge: true, priceConsentMissing: true } as In), 'cannot_charge')
  assert.equal(sb.shipBlockReason({ ...clean, overdueNotCharged: true, priceConsentMissing: true } as In), 'price_consent_missing')
  assert.match((sb.SHIP_BLOCK_LABEL as Record<string, string>).price_consent_missing ?? '', /인상동의.*발송금지/, 'CSV 라벨이 없다')

  const page = code('app', 'admin', 'personalization', 'picking-list', 'page.tsx')
  assert.match(page, /loadChargeProjection\(\s*createAdminClient\(\),[\s\S]{0,400}stopAtHold: true/, '포장 목록이 크론과 같은 판정(결제 회차 펼치기 held)을 안 쓴다')
  assert.match(page, /priceConsentMissing: !hasPaidOrder && \(nextRound\?\.held \?\? false\)/, '행에 보류 판정이 안 실린다 — ship-block 이 볼 수 없다')
  // 이번 발송분의 회차만 — 고객이 미룬 박스(+14일)의 다음 회차 금액·보류를 이번 박스에 붙이지 않는다.
  assert.match(page, /upcomingRound\.shipIso > shipDate \? null : upcomingRound/, '이번 발송분이 아닌(다음) 회차의 금액·보류를 이번 박스에 붙인다')
  assert.match(page, /if \(!proj\.ok\) \{\s*throw new Error\(/, '판정을 못 읽으면 "보류 아님"으로 접는다')
  assert.match(page, /r\.skippedNotCharged \? \([\s\S]{0,200}\) : r\.priceConsentMissing \? \([\s\S]{0,200}인상 동의 없음[\s\S]{0,200}\) : r\.overdueNotCharged \?/, '화면 배지 순서가 ship-block 과 다르다')
  assert.match(page, /r\.skippedNotCharged \|\|\s*r\.priceConsentMissing \|\|/, "'확인 필요' 건수에 보류 박스가 빠진다")
  const csvType = code('app', 'admin', 'personalization', 'picking-list', 'PickingListExport.tsx')
  assert.match(csvType, /priceConsentMissing: boolean/, 'PickingRow 에 보류 칸이 없다')
})

test('규칙244: 어드민 체험단 — 사람마다 회차 일정표(정본 함수)·다음 가격 전환일·동의 상태(30일 전부터 빨강)·동의 기록/취소(관리자 확인·작업 기록·확인창) (A1)', async () => {
  const cp = await load<CP>('lib', 'payments', 'charge-projection.ts')
  const pr = await load<PR>('lib', 'payments', 'price-rise.ts')
  const plan = await load<typeof import('./admin/trial-plan.ts')>('lib', 'admin', 'trial-plan.ts')
  const fp = new Map([['s1', { first: { amount: 51500, label: null }, recurring: { amount: 51500, label: null } }]])
  const rounds = cp.projectUserRounds({
    subs: [{ id: 's1', next_delivery_date: '2026-10-20', total_amount: 51500 }],
    trial: { cheap_remaining: 3, half_remaining: 4, cheap_price: 100, half_rate: 0.5 },
    lastPaidPhase: 'cheap',
    consents: [],
    fullPriceBySub: fp,
    fromIso: '2026-10-15',
    untilChargeIso: '2027-12-31',
    stopAtHold: false,
    maxRounds: 9,
  })
  // 일정표 = 크론 시뮬레이션과 같은 날짜·금액(손 계산 아님).
  assert.deepEqual(
    rounds.map((r) => `${r.chargeIso}:${r.chargeAmount}${r.rise ? `:${r.rise}` : ''}`),
    [
      '2026-10-20:100',
      '2026-11-03:100',
      '2026-11-17:100',
      '2026-12-01:25750:to_half',
      '2026-12-15:25750',
      '2026-12-29:25750',
      '2027-01-12:25750',
      '2027-01-23:51500:to_full',
      '2027-02-06:51500',
    ],
    '체험단 일정표가 청구 일정과 다르다',
  )
  assert.equal(rounds[0]!.listAmount, 51500)
  assert.ok(rounds[3]!.held && rounds[7]!.held, '동의 없는 인상 회차가 "동의 필요"로 안 보인다')

  // 30일 전부터 빨강 — 12/1 인상: 11/1 = 30일 전(빨강), 10/31 = 31일 전(아직 노랑).
  const v = plan.trialPlanView(rounds, [], '2026-11-01')
  assert.equal(v.next?.chargeIso, '2026-10-20')
  assert.equal(v.nextRiseIso, '2026-12-01', '다음 가격 전환일이 다르다')
  assert.equal(v.rises[0]!.status, 'urgent', '전환 30일 전인데 빨간색이 아니다')
  assert.equal(plan.trialPlanView(rounds, [], '2026-10-31').rises[0]!.status, 'waiting')
  assert.equal(v.rises[1]!.round?.chargeIso, '2027-01-23')
  assert.equal(v.rises[1]!.round?.prevAmount, 25750, '정가 전환 직전 금액(반값)이 다르다')
  const withConsent = plan.trialPlanView(rounds, [{ id: 'c1', rise: 'to_half', consented_on: '2026-10-14', channel: 'instagram_dm', memo: 'DM', revoked_at: null }], '2026-11-20')
  assert.equal(withConsent.rises[0]!.status, 'recorded')
  assert.equal(withConsent.rises[0]!.consent?.channel, 'instagram_dm')
  // 기록한 관리자 — 증빙(누가 남겼나)이 화면까지 간다.
  const byAdmin = plan.trialPlanView(rounds, [{ id: 'c1', rise: 'to_half', consented_on: '2026-10-14', channel: 'kakao', memo: '', revoked_at: null, recorded_by: 'admin-1' }], '2026-11-20')
  assert.equal(byAdmin.rises[0]!.consent?.recordedBy, 'admin-1', '기록한 관리자가 화면으로 안 간다')
  assert.equal(pr.CONSENT_RED_DAYS, 30)

  // 입력 검사 — 미래 날짜·모르는 경로 거절.
  assert.equal(pr.validateConsentInput({ rise: 'to_half', consentedOn: '2026-10-15', channel: 'instagram_dm' }, '2026-10-14').ok, false, '미래 날짜 동의를 받는다')
  assert.equal(pr.validateConsentInput({ rise: 'to_half', consentedOn: '2026-10-14', channel: 'fax' }, '2026-10-14').ok, false, '모르는 경로를 받는다')
  assert.equal(pr.validateConsentInput({ rise: 'to_more', consentedOn: '2026-10-14', channel: 'kakao' }, '2026-10-14').ok, false)
  assert.equal(pr.validateConsentInput({ rise: 'to_full', consentedOn: '2026-10-14', channel: 'kakao', memo: ' 좋아요 ' }, '2026-10-14').ok, true)

  // 펼치기는 정본 함수를 부른다(손 계산 금지).
  const proj = code('lib', 'payments', 'charge-projection.ts')
  for (const fn of ['trialPricing(', 'advanceTrialState(', 'chargeTimingFor(', 'chargeDateFor(', 'nextChargeDateAfterSuccess(', 'priceRiseBetween(', 'activeConsentFor(']) {
    assert.ok(proj.includes(fn), `회차 펼치기가 정본 함수 ${fn} 를 안 쓴다`)
  }
  const loader = code('lib', 'payments', 'charge-projection-load.ts')
  assert.match(loader, /resolveAutoDiscount\(\{ userId: s\.user_id, subtotal: s\.total_amount, afterTrial: true \}\)/, '서포터즈 첫 정가 금액이 청구 함수(resolveAutoDiscount)가 아니다')
  assert.match(loader, /recurringOnly: true/, '정가 반복 금액이 청구 함수가 아니다')
  const ad = code('lib', 'payments', 'auto-discount.ts')
  assert.match(ad, /const trial = recurringOnly \|\| afterTrial\s*\? null/, 'afterTrial 미리보기가 체험 가격만 빼지 않는다')

  // 화면·서버.
  const page = code('app', 'admin', 'trials', 'page.tsx')
  assert.match(page, /loadChargeProjection\(admin,/, '체험단 화면이 정본 펼치기를 안 쓴다')
  assert.match(page, /trialPlanView\(/)
  assert.ok(!/\*\s*0\.5|half_rate\s*\*/.test(page), '체험단 화면이 금액을 손으로 계산한다')
  const client = code('app', 'admin', 'trials', 'TrialsClient.tsx')
  assert.match(client, /window\.confirm\(`\$\{who\} 님의 '\$\{r\.label\}' 가격 인상 동의를 기록할까요\?/, '동의 기록에 확인창이 없다')
  assert.match(client, /window\.prompt\(`\$\{who\} 님의 '\$\{r\.label\}' 동의 기록을 취소할까요\?/, '기록 취소에 확인창이 없다')
  assert.match(client, /fetch\('\/api\/admin\/trials\/consents', \{\s*method: 'POST'/)
  assert.match(client, /fetch\('\/api\/admin\/trials\/consents', \{\s*method: 'DELETE'/)
  assert.match(client, /기록 \{\(r\.consent\.recordedBy && recorderNames\[r\.consent\.recordedBy\]\) \|\| '관리자'\}/, '동의 기록에 기록한 관리자가 안 보인다')
  assert.match(code('lib', 'payments', 'price-rise-context.ts'), /\.select\('[^']*recorded_by[^']*'\)/, '동의 기록을 읽을 때 기록한 관리자를 안 읽는다')
  assert.ok(!/bg-muted\b/.test(client), 'bg-muted 금지(어드민 토큰은 bg-secondary)')
  const api = code('app', 'api', 'admin', 'trials', 'consents', 'route.ts')
  assert.match(api, /if \(!\(await isAdmin\(supabase, user\)\)\)/, '동의 기록 API 가 관리자 확인을 안 한다')
  assert.match(api, /recordAdminAction\(gate\.supabase, \{\s*action: 'trial_price_consent_record'/, '동의 기록 작업 기록(admin_audit_log)이 없다')
  assert.match(api, /recordAdminAction\(gate\.supabase, \{\s*action: 'trial_price_consent_revoke'/, '기록 취소 작업 기록이 없다')
  assert.match(api, /validateConsentInput\(body, todayKstIsoDate\(\)\)/, '서버가 입력(미래 날짜 등)을 검사하지 않는다')
  assert.ok(!/\.delete\(\)/.test(api), '기록 취소가 행을 지운다 — 증빙은 revoked_at 표시로 남겨야 한다')
  assert.match(api, /revoked_at: new Date\(\)\.toISOString\(\), revoked_by: gate\.user\.id/)
  assert.ok(existsSync(join(ROOT, 'lib', 'payments', 'price-rise-context.ts')))
})

test('규칙245: 자동결제 이력 — 실패·보류·결과 불명 행에 고객·강아지·카드 끝 4자리·쉬운 말 사유·다음 재시도·고객 보기, "실패만 보기" 필터, 보류 회차 상자 (A2)', async () => {
  const cr = await load<typeof import('./admin/charge-rows.ts')>('lib', 'admin', 'charge-rows.ts')
  const be = await load<typeof import('./payments/billing-error-classify.ts')>('lib', 'payments', 'billing-error-classify.ts')
  for (const s of ['failed', 'pending', 'skipped']) assert.equal(cr.isProblemCharge(s), true, `${s} 행이 문제 행이 아니다`)
  assert.equal(cr.isProblemCharge('succeeded'), false)
  // 토스 코드는 고객 화면과 같은 정본(describeBillingError) 그대로.
  for (const c of ['REJECT_CARD_PAYMENT', 'INVALID_STOPPED_CARD', 'EXCEED_MAX_DAILY_PAYMENT_COUNT']) {
    assert.equal(cr.chargeProblemReason({ status: 'failed', error_code: c, error_message: 'raw english' }), be.describeBillingError(c).short, `${c} 사유가 정본과 다르다`)
  }
  assert.match(cr.chargeProblemReason({ status: 'pending', error_code: null, error_message: null }), /결과 확인 중/)
  assert.match(cr.chargeProblemReason({ status: 'failed', error_code: 'NO_SHIPPING_ADDRESS', error_message: 'x' }), /배송지/)
  assert.match(cr.chargeProblemReason({ status: 'failed', error_code: 'UNAUTHORIZED_KEY', error_message: 'x' }), /고객 카드 문제가 아니/)

  const view = code('app', 'admin', 'subscriptions', 'charges', 'ChargeRowsView.tsx')
  assert.match(view, /href=\{`\/admin\/users\/\$\{row\.user_id\}`\}/, "'고객 보기'가 고객 화면(/admin/users/[id])으로 가지 않는다")
  for (const k of ['카드 끝', '다음 재시도', '고객 보기', 'd.customerName', 'd.dogName', 'd.reason']) {
    assert.ok(view.includes(k), `문제 행에 '${k}' 가 없다`)
  }
  assert.match(view, /md:hidden/, '폰에서 볼 카드 목록이 없다(표는 가로로 넘친다)')
  const page = code('app', 'admin', 'subscriptions', 'charges', 'page.tsx')
  assert.match(page, /label="실패만 보기"/, "'실패만 보기' 필터가 없다")
  assert.match(page, /\.select\('id, user_id, dog_id, status, billing_card_last4, next_retry_at'\)/, '카드 끝 4자리·다음 재시도 시각을 읽지 않는다')
  assert.match(page, /chargeProblemReason\(r\)/)
  assert.match(page, /\.from\('subscription_charge_holds'\)[\s\S]{0,200}\.is\('resolved_at', null\)/, '열린 보류 회차를 보이지 않는다')
  assert.match(page, /holdsFailed = Boolean\(holdsRes\.error\)/, '보류 조회 실패를 "보류 없음"으로 접는다')
  assert.ok(!/bg-muted\b/.test(view + page))
})

test('규칙246: 다가오는 결제·포장 목록 금액 — 실제 나갈 금액(서포터즈 100원은 100원)과 정가, 합계는 실제 금액, 결제된 박스는 결제액 (A2)', async () => {
  const cp = await load<CP>('lib', 'payments', 'charge-projection.ts')
  const full = (amt: number) => ({ first: { amount: amt, label: null }, recurring: { amount: amt, label: null } })
  // 시험 계정(3af1665b 모양) — 11/10 발송분은 11/7(토)에 32,700원.
  const mine = cp.projectUserRounds({
    subs: [{ id: 'test', next_delivery_date: '2026-11-10', total_amount: 32700 }],
    trial: null,
    lastPaidPhase: 'full',
    consents: [],
    fullPriceBySub: new Map([['test', full(32700)]]),
    fromIso: '2026-10-15',
    untilChargeIso: '2026-12-09',
    stopAtHold: true,
  })
  assert.deepEqual(mine.map((r) => `${r.chargeIso}:${r.chargeAmount}`), ['2026-11-07:32700', '2026-11-21:32700', '2026-12-05:32700'], '시험 계정의 원치 않는 결제(11/7 32,700원)가 안 보인다')
  // 서포터즈 — 100원은 100원(정가 51,500원과 같이), 동의 없으면 12/1 은 보류 예정으로 멈추고 합계에서 빠진다.
  const sup = cp.projectUserRounds({
    subs: [{ id: 'sup', next_delivery_date: '2026-10-20', total_amount: 51500 }],
    trial: { cheap_remaining: 3, half_remaining: 4, cheap_price: 100, half_rate: 0.5 },
    lastPaidPhase: 'cheap',
    consents: [],
    fullPriceBySub: new Map([['sup', full(51500)]]),
    fromIso: '2026-10-15',
    untilChargeIso: '2026-12-31',
    stopAtHold: true,
  })
  assert.deepEqual(sup.map((r) => `${r.chargeIso}:${r.chargeAmount}:${r.listAmount}:${r.held}`), [
    '2026-10-20:100:51500:false',
    '2026-11-03:100:51500:false',
    '2026-11-17:100:51500:false',
    '2026-12-01:25750:51500:true',
  ], '서포터즈 실제 금액·보류 예정이 다르다')
  const groups = cp.groupRoundsByChargeDate([...sup, ...mine])
  const total = groups.reduce((s, g) => s + g.chargeTotal, 0)
  assert.equal(total, 100 * 3 + 32700 * 3, '합계가 실제 금액이 아니다(정가 합계거나 보류 예정을 더했다)')
  assert.equal(groups.find((g) => g.chargeIso === '2026-12-01')?.heldCount, 1)
  // 지난 결제일(재시도·따라잡기)은 다음 크론 날로.
  const overdue = cp.projectUserRounds({
    subs: [{ id: 'o', next_delivery_date: '2026-10-13', total_amount: 32700 }],
    trial: null,
    lastPaidPhase: 'full',
    consents: [],
    fullPriceBySub: new Map([['o', full(32700)]]),
    fromIso: '2026-10-15',
    untilChargeIso: '2026-10-31',
    stopAtHold: true,
  })
  assert.equal(overdue[0]?.chargeIso, '2026-10-15')
  assert.equal(overdue[0]?.late, true)

  // 다가오는 결제 = 청구 크론과 같은 대상 조건 · 보류에서 멈춤 · 캘린더에 실제 합계.
  const up = code('lib', 'admin', 'upcoming-charges.ts')
  assert.match(up, /\.eq\('status', 'active'\)\s*\.eq\('requires_billing_key_renewal', false\)\s*\.not\('billing_key', 'is', null\)/, '다가오는 결제 대상이 청구 크론 조건과 다르다')
  assert.match(up, /stopAtHold: true/)
  const cal = code('app', 'admin', 'subscriptions', 'calendar', 'page.tsx')
  assert.match(cal, /<UpcomingChargesView rounds=\{upcomingInWindow\}/, '캘린더에 다가오는 결제가 없다')
  assert.match(cal, /실제 결제 합계/, '캘린더 합계가 아직 할인 전 구독가다')
  const upView = code('app', 'admin', 'subscriptions', 'calendar', 'UpcomingChargesView.tsx')
  assert.match(upView, /groupRoundsByChargeDate\(rounds\)/)
  assert.match(upView, /r\.chargeAmount !== r\.listAmount/, '정가를 같이 보이지 않는다')

  // 포장 목록 금액 — 결제된 박스 = 주문의 결제액, 결제 전 = 결제 예정액, 칸 이름도 그대로, 합계는 실제.
  const page = code('app', 'admin', 'personalization', 'picking-list', 'page.tsx')
  assert.ok(!/r\.totalAmount|totalAmount: sub\.total_amount/.test(page), '포장 목록 금액이 아직 할인 전 구독가(total_amount)다')
  assert.equal((page.match(/paidAmount: o\.total_amount/g) ?? []).length, 2, '발송 대기·발송 완료 주문의 결제액을 읽지 않는다')
  assert.match(page, /amount: paidAmount \?\? nextRound\?\.chargeAmount \?\? null/, '결제 전 박스 금액이 결제 예정액이 아니다')
  assert.match(page, /`결제액 \$\{/)
  assert.match(page, /`결제 예정액 \$\{/)
  assert.match(page, /r\.amountKind === 'expected' && !r\.priceConsentMissing/, '보류될 박스 금액을 합계에 더한다')
  const csv = code('app', 'admin', 'personalization', 'picking-list', 'PickingListExport.tsx')
  assert.ok(csv.includes("'결제액(원)'") && csv.includes("'결제 예정액(원)'"), 'CSV 금액 칸 이름이 결제액·결제 예정액이 아니다')
  assert.ok(!csv.includes('청구액(원)'), "CSV 에 옛 '청구액' 칸(할인 전 구독가)이 남았다")
})
