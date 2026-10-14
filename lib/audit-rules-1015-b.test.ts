/**
 * 2026-10-15 어드민 수정 갈래 F-b '할 일·고객 화면·폰' 의 규칙 270~289 (가지 fix/1015-todo-customer).
 *
 * 10/14 어드민 20관점 조사에서 나온 급한 것·10/14 배포 기능의 결함을 고친 것. 문서에만 적은 규칙은 같은 날 또 어긴다 —
 * 고친 것을 테스트로 박는다. 규칙마다 고친 코드를 일부러 되돌려 빨간불이 켜지는지 검산했다(카나리아 — 보고서에 결과).
 * if 안에 단언을 넣지 않는다(조건이 거짓이 되면 조용히 무단언이 된다).
 *
 *   270 10/16 서포터즈 첫 박스 체크인 — '잘 안 먹어요'·메모 있는 '조금 가렸어요'를 경보함·이번 주 할 일·고객 화면에,
 *       손님 문구는 지킬 수 있는 약속만('다음 박스에 반영' 금지), '잘 안 먹어요'면 카카오톡 문의 길
 *   271 카톡 문의 메모 '다시 볼 날' — 오늘(KST) 이하 + 처리 안 됨을 이번 주 할 일 '늘'·홈 처리 대기·브리핑에
 *   272 서포터즈 인상 — 할 일·브리핑이 체험단 화면·청구와 같은 회차 펼치기(lastPaidPhase 포함)로 다음 인상을 고른다(11/18·1/13)
 *   273 웹 가게 주문 — 출고일(결제 다음 첫 화·목, lib/store 정본)이 지났는데 안 나가면 할 일·홈·브리핑에 빨강, 링크는 가게 주문만
 *   274 카드 재등록 대기 — 정본 isPausedByBillingFailure(멈춤 + 카드 거절 또는 3번 실패)로, 해지는 빼고
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

// 쓰지 않는 도우미 경고 방지 — 뒤 규칙들이 쓴다.
void walk
void rel

// ─────────────────────────────────────────────────────────────────────────────

test("규칙270: 첫 박스 체크인 — '잘 안 먹어요'·메모 답이 경보함·이번 주 할 일·고객 화면에 뜨고, 손님 문구는 지킬 수 있는 약속만", async () => {
  /**
   * # 왜 (2026-10-15 F-b, 조사 '10/16 서포터즈 첫 박스 체크인')
   * 10/16 11시에 서포터즈 6명에게 첫 체크인이 처음 나간다. '잘 안 먹어요'라고 답해도 그 답을 읽는 어드민 화면이 응답률 숫자뿐이었는데,
   * 손님에겐 '다음 박스에 반영할게요'라고 약속했다 — 지킬 장치가 없는 약속. 10/17~18 조리 전에 연락할 기회를 놓친다.
   */
  // 판정(순수) — 'poor' 늘, 'ok' 는 메모 있을 때만, 'great' 는 아니다.
  const fc = await load<typeof import('./first-checkin.ts')>('lib', 'first-checkin.ts')
  assert.equal(fc.firstCheckinNeedsOwner('poor', null), 'poor')
  assert.equal(fc.firstCheckinNeedsOwner('ok', '  변이 묽어요 '), 'note')
  assert.equal(fc.firstCheckinNeedsOwner('ok', '   '), null, "메모 없는 '조금 가렸어요'까지 경보로 올린다(시끄러움)")
  assert.equal(fc.firstCheckinNeedsOwner('great', '너무 잘 먹어요'), null)
  assert.deepEqual(fc.firstCheckinAlertOf('poor', null), { kind: 'feeding.first_checkin_poor', level: 'error' })
  assert.deepEqual(fc.firstCheckinAlertOf('ok', '메모'), { kind: 'feeding.first_checkin_note', level: 'warning' })
  assert.ok(!/반영/.test(fc.firstCheckinThanks('poor')), "보낸 뒤 알림이 '반영'을 약속한다 — 지킬 장치가 없다")
  assert.equal(fc.shortCheckinMemo('가'.repeat(50)).length, 41, '메모를 짧게 줄이지 않는다')

  // 경보함 종류가 정본 목록에 있다(없으면 recordAdminAlert 가 적어도 화면 이름·할 일이 없다).
  const k = await load<typeof import('./admin/alert-kinds.ts')>('lib', 'admin', 'alert-kinds.ts')
  assert.ok(k.isOwnerAlertKind('feeding.first_checkin_poor'), '경보함 목록에 feeding.first_checkin_poor 가 없다')
  assert.ok(k.isOwnerAlertKind('feeding.first_checkin_note'), '경보함 목록에 feeding.first_checkin_note 가 없다')
  assert.equal(k.alertTargetKey('feeding.first_checkin_poor', { dogId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222' }), 'dog:11111111-1111-4111-8111-111111111111', '같은 강아지 답이 한 줄로 묶이지 않는다')
  // 경보 한 줄에서 고객 화면(강아지 칸)으로 바로.
  const v = await load<typeof import('./admin/alert-view.ts')>('lib', 'admin', 'alert-view.ts')
  const uid = '33333333-3333-4333-8333-333333333333'
  const view = v.toAlertView(
    {
      id: 'a', kind: 'feeding.first_checkin_poor', severity: 'error', message: 'm', occurrences: 1,
      first_seen_at: '2026-10-16T02:10:00Z', last_seen_at: '2026-10-16T02:10:00Z', resolved_at: null, resolved_note: null,
      order_id: null, subscription_id: null, user_id: uid, dog_id: null, context: {},
    },
    { userBySub: new Map(), userByDog: new Map() },
  )
  assert.ok(view.links.some((l) => l.href === `/admin/users/${uid}#dogs`), '체크인 경보에서 고객 화면 강아지 칸으로 가는 링크가 없다')

  // 손님 화면 — 저장 뒤 서버 동작으로 경보함에, 지킬 수 있는 문구, '잘 안 먹어요'면 카카오톡 길.
  const client = code('app', '(main)', 'dogs', '[id]', 'first-checkin', 'FirstCheckinClient.tsx')
  assert.ok(!client.includes('다음 박스에 반영'), "손님에게 '다음 박스에 반영할게요'라고 약속한다 — 반영하는 장치가 없다")
  assert.ok(!client.includes('더 잘 맞는 추천을 드릴'), '체크인 답을 추천 엔진이 읽지 않는데 추천을 약속한다')
  assert.match(client, /firstCheckinNeedsOwner\(choice, trimmed\)\)\s*\{[\s\S]{0,120}notifyOwnerOfFirstCheckin\(dogId\)/, "'잘 안 먹어요'·메모 답을 저장한 뒤 사장님께 알리지 않는다")
  assert.match(client, /toast\.success\(firstCheckinThanks\(choice\)\)/, '보낸 뒤 알림이 판정 정본(firstCheckinThanks)이 아니다')
  assert.match(client, /choice === 'poor' && business\.kakaoChannelUrl[\s\S]{0,1500}href=\{business\.kakaoChannelUrl\}/, "'잘 안 먹어요'를 고른 손님에게 카카오톡 문의 길이 없다")
  assert.match(client, /catch \{[\s\S]{0,200}toast\.error\('인터넷 연결을 확인하고 다시 눌러 주세요'\)/, "인터넷이 끊기면 '저장 중'에서 멈추고 아무 안내가 없다")

  // 서버 동작 — 내용은 DB 에서(본인 답만), 경보함 기록은 정본 헬퍼, 메모는 가린다.
  const action = read('app', '(main)', 'dogs', '[id]', 'first-checkin', 'actions.ts')
  assert.match(action, /^'use server'/, 'actions.ts 가 서버 동작이 아니다')
  const act = stripComments(action)
  assert.match(act, /from\('feeding_outcomes'\)[\s\S]{0,200}\.eq\('user_id', user\.id\)[\s\S]{0,80}\.eq\('source', 'first_box_checkin'\)/, '경보 내용을 본인 답(DB)이 아닌 곳에서 만든다')
  assert.match(act, /recordAdminAlert\(alert\.level, alert\.kind,/, '경보함 기록이 정본 헬퍼(recordAdminAlert)가 아니다')
  assert.match(act, /scrubSentryString\(row\.comment\)/, '손님 메모를 가리지 않고 경보함에 적는다')

  // 이번 주 할 일 — 경보함과 별개로 DB 에서 직접(경보함 기록이 실패해도 놓치지 않게).
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(wt, /from\('feeding_outcomes'\)[\s\S]{0,120}\.eq\('source', 'first_box_checkin'\)/, "이번 주 할 일이 첫 박스 체크인 답을 읽지 않는다")
  assert.match(wt, /key: 'first-checkin'/, "이번 주 할 일 '늘'에 첫 박스 반응 칸이 없다")
  assert.match(wt, /firstCheckinNeedsOwner\(c\.palatability, c\.comment\)/, '할 일의 판정이 정본(firstCheckinNeedsOwner)이 아니다')
  assert.match(wt, /firstCheckinLine\(dogName\.get\(c\.dog_id\)/, '할 일 줄에 강아지 이름·답·메모가 없다')
  assert.match(wt, /href: `\/admin\/users\/\$\{c\.user_id\}#dogs`/, '할 일 줄에서 고객 화면으로 가는 링크가 없다')
  assert.match(wt, /checkinRes\.error \|\| checkinPoor > 0 \? 'bad'/, "'잘 안 먹어요'·조회 실패가 빨강이 아니다")
  // 브리핑(잠금 화면) — 이름·메모 없이 수만.
  const brief = wt.slice(wt.indexOf('export function briefingExtraLines('))
  assert.match(brief, /n\.firstCheckinPoor > 0\) out\.push\(/, "아침 브리핑에 '잘 안 먹어요' 줄이 없다")

  // 고객 한 명 화면 — 강아지 칸에 '첫 박스 반응'.
  const data = code('app', 'admin', 'users', '[id]', '_data.ts')
  assert.match(data, /from\('feeding_outcomes'\)[\s\S]{0,120}\.eq\('source', 'first_box_checkin'\)/, '고객 화면이 첫 박스 체크인 답을 읽지 않는다')
  assert.match(data, /fail\('checkin', checkinRes\.error\)/, '체크인 조회 실패를 칸 오류로 알리지 않는다(규칙1)')
  const view2 = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  assert.match(view2, /<Row label="첫 박스 반응">/, "고객 화면 강아지 칸에 '첫 박스 반응' 줄이 없다")
  assert.match(view2, /<Section id="dogs"/, '경보·할 일 링크(#dogs)가 닿을 강아지 칸 표지가 없다')
})

test("규칙271: 카톡 문의 메모의 '다시 볼 날'이 이번 주 할 일 '늘'·홈 처리 대기·브리핑에 뜬다", () => {
  /**
   * # 왜 (조사 '카톡 문의 메모의 다시 볼 날이 어드민 홈·이번 주 할 일 어디에도 안 뜬다')
   * 고객 화면(C2)은 "'다시 볼 날'이 오늘이면 어드민 홈 할 일에 떠요"라고 안내했는데, admin_customer_notes 를 읽는 곳은 고객 화면뿐이었다.
   * 앱 문의는 전부 카톡으로 와서 이 메모가 유일한 추적 수단 — 답을 약속받은 문의가 잊힌다.
   */
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(
    wt,
    /\.from\('admin_customer_notes'\)\s*\.select\('id, user_id, body, follow_up_on'\)\s*\.eq\('done', false\)\s*\.not\('follow_up_on', 'is', null\)\s*\.lte\('follow_up_on', today\)/,
    "이번 주 할 일이 문의 메모의 '다시 볼 날'(오늘 이하·처리 안 됨)을 읽지 않는다",
  )
  assert.match(wt, /key: 'follow-up'/, "'늘' 칸에 다시 볼 문의 항목이 없다")
  assert.match(wt, /if \(followUpRes\.error\) failures\.push\(/, "메모 조회 실패를 '없음'으로 접는다(규칙1)")
  assert.match(wt, /href: `\/admin\/users\/\$\{f\.user_id\}#notes`/, '다시 볼 문의 줄에서 그 고객 화면(문의 기록 칸)으로 가지 않는다')
  assert.match(wt, /followUpDue: followUpRes\.error \? null : followUps\.length/, '홈·브리핑이 쓸 숫자(followUpDue)가 없다')
  const brief = wt.slice(wt.indexOf('export function briefingExtraLines('))
  assert.match(brief, /n\.followUpDue > 0\) out\.push\(/, '아침 브리핑에 다시 볼 문의 줄이 없다')
  const home = code('app', 'admin', 'page.tsx')
  assert.match(home, /followUpDueCount=\{todo\.numbers\.followUpDue \?\? 0\}/, '홈 처리 대기에 다시 볼 문의 숫자가 없다(이번 주 할 일과 같은 숫자여야)')
  const panel = code('components', 'admin', 'ActionsPanel.tsx')
  assert.match(panel, /count: props\.followUpDueCount \?\? 0/, '처리 대기 칸이 다시 볼 문의를 그리지 않는다')
  assert.match(code('app', 'admin', 'users', '[id]', 'CustomerView.tsx'), /<Section\s+id="notes"/, '할 일 링크(#notes)가 닿을 문의 기록 칸 표지가 없다')
})

test('규칙272: 서포터즈 인상 — 이번 주 할 일·브리핑이 체험단 화면·청구와 같은 회차 펼치기로 다음 인상을 고른다(11/18 반값·1/13 정가)', async () => {
  /**
   * # 왜 (조사 '이번 주 할 일·아침 브리핑이 인상 직전 2주 동안 그 인상과 동의 없음을 놓친다')
   * 할 일은 '지금 구간'을 남은 회차로만 정했다(nextTrialTransitions). 청구 크론은 '마지막으로 결제한 구간'(lastPaidPhase)과 비교한다.
   *  ① 11/18(11/17 마지막 100원 결제 직후): 크론은 12/1 반값 인상 보류인데 할 일은 '1/23 정가 전환'만 말했다.
   *  ② 1/13(1/12 마지막 반값 결제 직후): 크론은 1/23 정가 인상 보류인데 할 일은 '전환 예정 없음'이었다.
   */
  const cp = await load<typeof import('./payments/charge-projection.ts')>('lib', 'payments', 'charge-projection.ts')
  const tt = await load<typeof import('./admin/trial-transitions.ts')>('lib', 'admin', 'trial-transitions.ts')
  const full = new Map([['sub', { first: { amount: 51500, label: null }, recurring: { amount: 51500, label: null } }]])
  const plan = (trial: { cheap_remaining: number; half_remaining: number }, last: 'cheap' | 'half' | 'full' | null, nextShip: string, fromIso: string) => {
    const t = { ...trial, cheap_price: 100, half_rate: 0.5 }
    const rounds = cp.projectUserRounds({
      subs: [{ id: 'sub', next_delivery_date: nextShip, total_amount: 51500 }],
      trial: t,
      lastPaidPhase: last,
      consents: [],
      fullPriceBySub: full,
      fromIso,
      untilChargeIso: '2027-12-31',
      stopAtHold: false,
      maxRounds: t.cheap_remaining + t.half_remaining + 2,
    })
    return tt.trialTransitionsFromRounds([{ userId: 'u', rounds, trial: t, lastPaidPhase: last }], new Map([['sub', 'dog']]))
  }

  // ① 11/18 — 남은 100원 0회·반값 4회, 마지막 결제 = 100원.
  const a = plan({ cheap_remaining: 0, half_remaining: 4 }, 'cheap', '2026-12-01', '2026-11-18')
  assert.equal(a.length, 1, '11/18 에 다음 인상을 못 찾는다')
  assert.deepEqual([a[0]!.phase, a[0]!.nextPhase, a[0]!.chargeIso], ['cheap', 'half', '2026-12-01'], '11/18 의 다음 인상이 12/1 반값이 아니다(청구 크론은 12/1 을 보류한다)')
  assert.deepEqual([a[0]!.fromAmount, a[0]!.toAmount], [100, 25750])
  assert.equal(a[0]!.dogId, 'dog')
  assert.equal(tt.trialConsentState(a[0]!, [], '2026-11-18').status, 'urgent', "11/18 에 '동의 없음'이 빨간불이 아니다")

  // ② 1/13 — 남은 회차 0, 마지막 결제 = 반값 → 1/26 발송분(1/23 토 결제)이 정가 인상.
  const b = plan({ cheap_remaining: 0, half_remaining: 0 }, 'half', '2027-01-26', '2027-01-13')
  assert.equal(b.length, 1, "1/13 에 '전환 예정 없음' — 1/23 정가 인상을 놓친다")
  assert.deepEqual([b[0]!.phase, b[0]!.nextPhase, b[0]!.chargeIso], ['half', 'full', '2027-01-23'], '1/13 의 다음 인상이 1/23 정가가 아니다')
  assert.deepEqual([b[0]!.fromAmount, b[0]!.toAmount], [25750, 51500])
  assert.equal(tt.trialConsentState(b[0]!, [], '2027-01-13').status, 'urgent')

  // 도장 취소(F-a: 남은 회차 0 으로) 뒤 — 마지막 결제가 100원이면 다음 결제가 정가 인상(동의 장치를 건너뛰지 않는다).
  const c = plan({ cheap_remaining: 0, half_remaining: 0 }, 'cheap', '2026-10-20', '2026-10-15')
  assert.deepEqual([c[0]!.phase, c[0]!.nextPhase], ['cheap', 'full'], '도장 취소 뒤 100원 → 정가 인상을 못 본다')
  // 정가까지 결제된 사람(앞 구간 = 정가)은 인상이 없다.
  assert.equal(plan({ cheap_remaining: 0, half_remaining: 0 }, 'full', '2027-02-09', '2027-01-27').length, 0, '정가 결제 뒤에도 인상이 남았다고 한다')

  // 할 일이 이 정본을 쓴다(체험단 화면과 같은 펼치기: stopAtHold false · 마지막 결제 구간).
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(wt, /loadChargeProjection\(\s*db,/, '이번 주 할 일이 청구·체험단 화면과 같은 회차 펼치기(loadChargeProjection)를 안 쓴다')
  assert.match(wt, /stopAtHold: false,/, '할 일의 회차 펼치기가 체험단 일정표와 다르다(보류 회차에서 멈춘다)')
  assert.match(wt, /transitions = trialTransitionsFromRounds\(/, '할 일의 서포터즈 항목이 정본 회차에서 인상을 고르지 않는다')
  assert.match(wt, /lastPaidPhase: c\?\.lastPaidPhase \?\? null/, "할 일이 '마지막으로 결제한 구간'을 넘기지 않는다")
  assert.ok(!/nextTrialTransitions\(/.test(wt), '이번 주 할 일이 남은 회차만 보는 옛 판정(nextTrialTransitions)을 쓴다')
  assert.match(wt, /if \(!proj\.ok\) failures\.push\(/, "회차 일정 조회 실패를 '전환 예정 없음'으로 접는다(규칙1)")
})

test("규칙273: 웹 가게 주문 — 출고일(결제 다음 첫 화·목)이 지났는데 안 나가면 할 일·홈·브리핑에 빨강, '가게 주문 보러 가기'는 가게 주문만", async () => {
  /**
   * # 왜 (조사 '웹 가게 주문은 발송일이 지나도 미발송 경보가 울리지 않음' · '웹 가게 출고 대기 링크가 가게 주문만 거르지 않음')
   * 10/14 배포에서 미발송 판정이 정기배송 주문만 받았고, 가게 주문은 개수(파란색)만 셌다 — 토스 심사가 통과돼 가게가 열리면
   * 돈을 낸 손님 박스가 화·목을 지나도 아무도 모른다. 링크는 정기배송 박스와 섞인 목록을 열었다.
   */
  const c = await load<typeof import('./admin/weekly-todo-core.ts')>('lib', 'admin', 'weekly-todo-core.ts')
  const wed = { id: 'w', paid_at: '2026-10-14T03:00:00Z', created_at: '2026-10-14T03:00:00Z', order_number: 'FTS-1' } // 수 결제 → 목 10/15 출고
  const thu = { id: 't', paid_at: '2026-10-15T03:00:00Z', created_at: '2026-10-15T03:00:00Z', order_number: 'FTS-2' } // 목 결제 → 화 10/20 출고
  const r16 = c.classifyStoreOrders([wed, thu], '2026-10-16')
  assert.deepEqual(r16.overdue.map((o) => o.id), ['w'], '목요일 출고분이 금요일에도 안 나갔는데 출고일 지남으로 안 센다')
  assert.equal(r16.outgoing, 2)
  const r15 = c.classifyStoreOrders([wed, thu], '2026-10-15')
  assert.deepEqual([r15.overdue.length, r15.dueToday], [0, 1], '출고 당일을 지남으로 센다(또는 오늘 출고를 못 센다)')
  // KST 날짜 — 목요일 새벽 1시 반(KST) 결제(UTC 로는 수요일 16시 반)는 목요일 결제 → 다음 화요일 출고(금요일엔 지남 아님).
  const lateNight = { id: 'n', paid_at: '2026-10-14T16:30:00Z', created_at: '2026-10-14T16:30:00Z', order_number: 'FTS-3' }
  assert.equal(c.classifyStoreOrders([lateNight], '2026-10-16').overdue.length, 0, '결제일을 UTC 날짜로 읽는다(KST 목요일 새벽 결제를 수요일로)')

  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(wt, /const store = classifyStoreOrders\(storeRows, today\)/, '할 일이 가게 주문의 출고일 지남을 판정하지 않는다')
  assert.match(wt, /tone: !ordersCountable \|\| store\.overdue\.length > 0 \? 'bad'/, '출고일 지난 가게 주문이 빨강이 아니다')
  assert.match(wt, /href: '\/admin\/orders\?status=preparing&kind=store'/, "'가게 주문 보러 가기'가 가게 주문만 거르지 않는다")
  assert.match(wt, /storeOverdue: ordersCountable \? store\.overdue\.length : 0/)
  const brief = wt.slice(wt.indexOf('export function briefingExtraLines('))
  assert.match(brief, /if \(n\.storeOverdue > 0\) out\.push\(/, '아침 브리핑에 출고일 지난 가게 주문 줄이 없다(요일과 무관하게)')
  const home = code('app', 'admin', 'page.tsx')
  assert.match(home, /const storeOverdueCount = todo\.numbers\.storeOverdue/, '홈이 가게 출고일 지남을 할 일과 같은 숫자로 안 쓴다')
  assert.match(home, /storeOverdueCount=\{storeOverdueCount\}/, '홈 처리 대기에 가게 출고일 지남이 없다')
  assert.match(home, /tone=\{overdueUnshippedCount \+ storeOverdueCount > 0 \? 'red'/, "'발송할 주문'이 가게 출고일 지남에 빨갛게 안 된다")
  const panel = code('components', 'admin', 'ActionsPanel.tsx')
  assert.match(panel, /href: '\/admin\/orders\?status=preparing&kind=store',[\s\S]{0,120}count: props\.storeOverdueCount \?\? 0/, '처리 대기의 가게 출고일 지남 칸이 가게 주문 목록으로 가지 않는다')
  // 출고 요일 정본은 lib/store(손님 화면이 약속한 날과 같다) — 여기서 다시 짜지 않는다.
  assert.match(code('lib', 'admin', 'weekly-todo-core.ts'), /storeShipDate\(kstDateOf\(o\.paid_at \?\? o\.created_at\)\)/, '가게 출고일을 정본(storeShipDate)이 아닌 식으로 센다')
})

test('규칙274: 카드 재등록 대기 — 정본 isPausedByBillingFailure(멈춤 + 카드 거절 또는 3번 실패)로 센다, 해지는 뺀다', () => {
  /**
   * # 왜 (조사 '잔액 부족 등으로 3번 실패해 멈춘 구독이 홈 어디에도 안 뜸')
   * 청구 크론은 잔액 부족류 확정 거절이 3번이면 status='paused' 로 멈추지만 requires_billing_key_renewal 은 켜지 않는다.
   * 할 일·홈의 '카드 재등록 대기'는 그 표시만 셌다 — 정기 매출이 조용히 끊기고 연락할 기회를 놓친다.
   */
  const wt = code('lib', 'admin', 'weekly-todo.ts')
  assert.match(
    wt,
    /\.neq\('status', 'cancelled'\)[\s\S]{0,160}\.or\('requires_billing_key_renewal\.eq\.true,status\.eq\.paused'\)/,
    '카드 재등록 대기 조회가 3번 실패로 멈춘 구독(표시 안 켜짐)을 읽지 않는다 / 해지된 구독까지 센다',
  )
  assert.match(wt, /isPausedByBillingFailure\(r\) \|\| \(r\.requires_billing_key_renewal === true && r\.status !== 'cancelled'\)/, '카드 재등록 대기 판정이 정본(isPausedByBillingFailure)이 아니다')
  assert.ok(!/\.eq\('requires_billing_key_renewal', true\)\.limit\(LIMIT\)/.test(wt), "옛 판정(표시만 셈)이 남아 있다")
  assert.match(code('app', 'admin', 'page.tsx'), /const cardRenewalCount = todo\.numbers\.cardRenewal/, '홈 카드 재등록 숫자가 할 일과 다르다')
})

/** user_id 칸을 가진 admin_* 표 — 생성 타입(lib/supabase/types.ts)과 마이그레이션(create table) 둘 다에서 모은다. */
function adminTablesWithUserId(): string[] {
  const out = new Set<string>()
  const types = read('lib', 'supabase', 'types.ts')
  for (const m of types.matchAll(/\n\s+(admin_\w+): \{\n\s+Row: \{([\s\S]*?)\n\s+\}/g)) {
    if (/\n\s+user_id: /.test(m[2]!)) out.add(m[1]!)
  }
  const dir = join(ROOT, 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '')
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(admin_\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (/\n\s*user_id\s+uuid/i.test(m[2]!)) out.add(m[1]!)
    }
  }
  return [...out].sort()
}

test("규칙275: 탈퇴 — user_id 를 가진 admin_* 표는 전부 탈퇴 라우트가 지우고, 탈퇴 회원은 '탈퇴한 회원'으로 보이며 고치기·메모·메시지를 서버가 거절한다", () => {
  /**
   * # 왜 (조사 '탈퇴해도 카톡 문의 기록이 지워지지 않는다' · '탈퇴 회원이 일반 회원처럼 보이고 주소 고치기·메모·메시지가 열려 있다')
   * 10/14 새 표 admin_customer_notes 가 탈퇴 라우트에서 빠졌다(auth 는 soft delete 라 FK cascade 는 5년 뒤에만 돈다). 표가 새로 생길
   * 때마다 같은 구멍이 다시 생긴다 — 그래서 '표 목록'을 저장소에서 자동으로 모아 대조한다. 또 익명화한 계정에 관리자가 이름·전화·주소를
   * 다시 써 넣을 수 있었다.
   */
  const tables = adminTablesWithUserId()
  for (const t of ['admin_alerts', 'admin_customer_notes', 'admin_user_notes', 'admin_address_changes']) {
    assert.ok(tables.includes(t), `user_id 를 가진 admin_* 표 목록에 ${t} 가 없다 — 표 찾기가 깨졌다(무단언 방지)`)
  }
  const del = code('app', 'api', 'account', 'delete', 'route.ts')
  for (const t of tables) {
    assert.match(del, new RegExp(`from\\('${t}'\\)\\s*\\.delete\\(\\)`), `탈퇴 라우트가 ${t}(고객 user_id 를 가진 어드민 표)를 지우지 않는다`)
  }
  assert.match(del, /captureBusinessEvent\('error', 'account\.delete\.partial_failure', \{\s*userId: user\.id,\s*step,/, '문의 기록·경보·주소 기록 파기 실패를 경보함(account.delete.partial_failure)에 올리지 않는다')

  // 서버 거절 — 관문 하나(rejectDeletedCustomer)를 쓰기 라우트가 부른다.
  const guard = code('app', 'api', 'admin', 'users', '_guard.ts')
  assert.match(guard, /\.select\('id, deleted_at'\)[\s\S]{0,200}if \(error\) return[\s\S]{0,200}if \(data\.deleted_at\)[\s\S]{0,120}status: 409/, '탈퇴 회원 관문이 deleted_at 을 보고 409 로 막지 않는다(조회 실패도 막아야)')
  const addr = code('app', 'api', 'admin', 'users', '[id]', 'address', 'route.ts')
  assert.match(addr, /const deleted = await rejectDeletedCustomer\(admin, id\)\s*if \(deleted\) return deleted/, '배송지 고치기가 탈퇴 회원을 막지 않는다')
  const notes = code('app', 'api', 'admin', 'users', '[id]', 'notes', 'route.ts')
  assert.equal((notes.match(/await rejectDeletedCustomer\(admin, id\)/g) ?? []).length, 2, '문의 기록 쓰기·고치기(2곳)가 탈퇴 회원을 막지 않는다')
  assert.match(code('app', 'api', 'admin', 'users', '[id]', 'note', 'route.ts'), /if \(note\) \{\s*const deleted = await rejectDeletedCustomer\(admin, id\)/, '운영 메모가 탈퇴 회원에게 새로 적힌다')
  assert.match(code('app', 'api', 'admin', 'users', '[id]', 'allergies', 'route.ts'), /if \(action !== 'preview'\) \{\s*const deleted = await rejectDeletedCustomer\(admin, id\)/, '알레르기 고치기가 탈퇴 회원을 막지 않는다')
  assert.match(code('app', 'api', 'admin', 'users', '[id]', 'message', 'route.ts'), /if \(targetProfile\.deleted_at\) \{\s*return NextResponse\.json\(\{ ok: false, error: 'deleted_customer' \}, \{ status: 409 \}\)/, '1:1 메시지가 탈퇴 회원에게 간다')

  // 화면 — 탈퇴 표시, 고치기·메모·메시지 숨김. 목록·챙길 손님에서 뺀다.
  assert.match(code('app', 'admin', 'users', '[id]', '_data.ts'), /created_at, deleted_at'\)/, '고객 화면이 탈퇴 여부(deleted_at)를 읽지 않는다')
  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  assert.match(view, /탈퇴한 회원 · \{formatKstDate\(profile\.deletedAt\)\}/, "고객 화면에 '탈퇴한 회원' 표시가 없다")
  assert.match(view, /!errors\.address && !deleted && !errors\.paid_box && \(\s*<AddressEditor/, '탈퇴 회원에게 배송지 고치기가 열려 있다')
  assert.match(view, /readOnly=\{deleted\}/, '탈퇴 회원에게 문의 기록 쓰기가 열려 있다')
  assert.match(view, /\{!deleted && \(\s*<Link\s+href=\{`\/admin\/users\/\$\{data\.userId\}\/message`\}/, '탈퇴 회원에게 1:1 메시지 단추가 보인다')
  assert.match(code('app', 'admin', 'users', 'page.tsx'), /\.select\(USER_COLS, \{ count: 'exact' \}\)[\s\S]{0,300}\.is\('deleted_at', null\)/, '회원 목록·총 인원에 탈퇴 회원이 들어간다')
})

test("규칙276: 고객 화면 쓰기의 작업 기록 — 문의 메모 쓰기·고치기·지우기(바꾸기 전 값), 운영 메모, 배송지의 바꾸기 전 값(탈퇴 때 지워지는 표), 앞당긴 제안", () => {
  /**
   * # 왜 (조사 '새 카톡 문의 기록과 운영 메모는 쓰기·고치기·지우기가 하나도 기록되지 않는다' · '배송지를 고치면 옛 주소가 어디에도 남지 않는다')
   * 잘못 누른 지우기·처리함·본문 수정을 되돌릴 단서가 없었고, 결제된 박스의 주문 주소까지 흔적 없이 바뀌었다.
   * 주소 원문은 지울 수 없는 작업 기록에 넣지 않는다(규칙257) — 탈퇴하면 같이 지우는 별도 표(admin_address_changes)에 둔다.
   */
  const notes = code('app', 'api', 'admin', 'users', '[id]', 'notes', 'route.ts')
  for (const a of ['customer_note_create', 'customer_note_update', 'customer_note_delete']) {
    assert.match(notes, new RegExp(`recordAdminAction\\(gate\\.supabase, \\{\\s*action: '${a}'`), `문의 기록 ${a} 가 작업 기록에 안 남는다`)
  }
  assert.match(notes, /action: 'customer_note_update',[\s\S]{0,200}before: noteForAudit\(/, '문의 기록 고치기가 바꾸기 전 값을 안 남긴다')
  assert.match(notes, /action: 'customer_note_delete',[\s\S]{0,120}before: noteForAudit\(before\)/, '문의 기록 지우기가 지운 내용을 안 남긴다')
  assert.match(notes, /body: scrubSentryString\(n\.body\)\.slice\(0, 200\)/, '작업 기록의 메모 본문을 가리지 않는다(전화·메일 모양)')
  const memo = code('app', 'api', 'admin', 'users', '[id]', 'note', 'route.ts')
  assert.match(memo, /recordAdminAction\(supabase, \{\s*action: note \? 'customer_memo_update' : 'customer_memo_delete'/, '운영 메모 덮어쓰기·지우기가 작업 기록에 안 남는다')
  assert.match(memo, /before: \{ note: prevNote \? scrubSentryString\(prevNote\)\.slice\(0, 200\) : null \}/, '운영 메모의 바꾸기 전 값이 없다')

  const addr = code('app', 'api', 'admin', 'users', '[id]', 'address', 'route.ts')
  const logAt = addr.indexOf(".from('admin_address_changes')\n      .insert(")
  const updAt = addr.indexOf(".from('addresses')\n      .update(next)")
  const ordAt = addr.indexOf(".from('orders')\n      .update(")
  assert.ok(logAt > 0 && updAt > logAt && ordAt > logAt, '배송지·주문 주소를 바꾸기 전에 옛 값을 기록하지 않는다')
  assert.match(addr, /before_address: cur\s*\?/, '옛 기본 배송지를 기록하지 않는다')
  assert.match(addr, /orders_before: ordersBefore,/, '같이 바꾸는 주문의 옛 주소를 기록하지 않는다')
  assert.match(addr, /if \(logErr \|\| !logRow\) \{[\s\S]{0,200}CHANGE_LOG_FAILED/, '옛 값을 못 남겨도 바꾼다(되살릴 단서 없이 덮는다)')
  assert.match(addr, /changeId,\s*orderIds: updatedOrderIds,/, '작업 기록에 바꾼 주소 기록 id·바뀐 주문 id 가 없다')
  const mig = readFileSync(join(ROOT, 'supabase', 'migrations', '20261015110000_admin_address_changes.sql'), 'utf8').replace(/--[^\n]*/g, '')
  assert.match(mig, /user_id uuid not null references auth\.users\(id\) on delete cascade/)
  assert.match(mig, /revoke all on table public\.admin_address_changes from anon, authenticated;/, '주소 기록 표가 고객에게 열려 있다')
  assert.match(mig, /do \$\$[\s\S]*raise exception/, '주소 기록 마이그레이션에 자기 검증이 없다')

  assert.match(code('app', 'api', 'admin', 'users', '[id]', 'allergies', 'route.ts'), /action: 'dog_proposal_request'/, "'제안만 다시 보내기'(propose)가 작업 기록에 안 남는다")
})

test("규칙277: 고객 화면 폼은 인터넷이 끊겨도 '저장 중'에서 멈추지 않고, 1:1 메시지는 문의함 저장과 알림 결과를 따로 말한다", async () => {
  /**
   * # 왜 (조사 '문의 메모·배송지·알레르기 저장: 인터넷이 끊기면 저장 중으로 멈춤' · '1:1 메시지 — 문의함엔 들어갔는데 발송되지 않았어요,
   *   반대로 저장 실패에도 발송했어요' · '알레르기 고치기 — 제안 저장 실패가 3초 회색 안내' · '결제된 박스 조회 실패 때 같이 바꾸기가 사라짐')
   */
  const send = await load<typeof import('../app/admin/users/[id]/_send.ts')>('app', 'admin', 'users', '[id]', '_send.ts')
  const realFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const r = await send.sendAdminJson('/x', 'POST', {})
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.offline, true, '요청이 던지면(인터넷 끊김) 결과로 바꾸지 않는다')
    globalThis.fetch = (async () => new Response('<html>504</html>', { status: 504 })) as typeof fetch
    const r2 = await send.sendAdminJson('/x', 'PATCH', {}, '저장하지 못했어요')
    assert.equal(r2.ok === false && r2.message, '저장하지 못했어요(504)', 'JSON 이 아닌 오류 응답(504)을 처리하지 못한다')
  } finally {
    globalThis.fetch = realFetch
  }
  for (const f of [
    ['app', 'admin', 'users', '[id]', 'NotesPanel.tsx'],
    ['app', 'admin', 'users', '[id]', 'AddressEditor.tsx'],
    ['app', 'admin', 'users', '[id]', 'AllergyEditor.tsx'],
    ['app', 'admin', 'users', '[id]', 'message', 'AdminNoteCard.tsx'],
  ]) {
    const src = code(...f)
    assert.ok(!/await fetch\(/.test(src), `${f.join('/')}: 끊김을 못 받는 맨 fetch 가 남아 있다(_send 를 쓸 것)`)
    assert.match(src, /sendAdminJson/, `${f.join('/')}: 요청 도우미(_send)를 안 쓴다`)
    assert.match(src, /\} finally \{\s*set(Saving|Busy|BusyId)\((false|null)\)/, `${f.join('/')}: 단추를 finally 로 풀지 않는다('저장 중'에서 멈춘다)`)
  }

  // 1:1 메시지 — 문의함 먼저, 실패면 알림도 안 보냄, 응답은 둘을 따로.
  const msg = code('app', 'api', 'admin', 'users', '[id]', 'message', 'route.ts')
  const csAt = msg.indexOf(".from('cs_messages').insert(")
  const pushAt = msg.indexOf('await pushToUser(')
  assert.ok(csAt > 0 && pushAt > csAt, '1:1 메시지가 문의함 저장보다 알림을 먼저 보낸다')
  assert.match(msg, /if \(csErr\) \{[\s\S]{0,200}error: 'inbox_save_failed'[\s\S]{0,60}status: 500/, '문의함 저장 실패를 오류로 돌려주지 않는다(발송했어요로 보인다)')
  assert.match(msg, /ok: true,\s*inboxSaved: true,\s*pushOk: result\.ok,/, '응답이 문의함 저장과 알림 결과를 가르지 않는다')
  const comp = code('app', 'admin', 'users', '[id]', 'message', 'MessageComposer.tsx')
  assert.ok(!comp.includes('알림 동의 후 다시 시도'), "문의함엔 들어갔는데 '다시 시도'를 권한다(같은 글이 두 번 쌓인다)")
  assert.match(comp, /inbox_save_failed: '앱 문의함에 저장하지 못했어요/, '문의함 저장 실패 안내가 없다')
  assert.match(comp, /앱 문의함에 남겼어요 · 알림 기기가 없어 알림은 안 갔어요/, '알림 기기가 없을 때 문의함엔 남았다고 말하지 않는다')
  assert.match(comp, /catch \{[\s\S]{0,200}보냈는지 확인하지 못했어요/, '끊김 때 결과를 모른다고 말하지 않는다')

  // 알레르기 — 제안 저장 실패는 빨간 오류 + 창 유지 + '제안만 다시 보내기'.
  const al = code('app', 'admin', 'users', '[id]', 'AllergyEditor.tsx')
  assert.match(al, /proposal\.code !== 'NO_ACTIVE_SUBSCRIPTION'\) \{[\s\S]{0,300}toast\.error\([\s\S]{0,200}setProposalFailed\(/, '제안 저장 실패를 회색 안내로 끝낸다')
  assert.match(al, /post\('propose'\)/, "'새 식단 제안만 다시 보내기'(서버 propose)가 없다")
  // 배송지 — 결제된 박스를 못 읽으면 고치기를 막고 이유를 말한다.
  assert.match(code('app', 'admin', 'users', '[id]', 'CustomerView.tsx'), /!errors\.address && !deleted && errors\.paid_box && \(\s*<p[\s\S]{0,200}결제된 발송 대기 박스를 확인하지 못했어요/, "결제된 박스 조회 실패 때 '같이 바꾸기'가 조용히 사라진다")
})

test('규칙278: 고객 한 명 화면에 서포터즈 인상 동의·보류 — 체험단 화면과 같은 정본(loadChargeProjection → trialPlanView), 읽기만', () => {
  /**
   * # 왜 (조사 '고객 한 명 화면에 인상 동의·보류 상태가 없다 — 보류될 회차도 정상 결제처럼 보인다')
   * 서포터즈가 '12/1 박스 왜 안 와요?'라고 물을 때 그 손님 화면은 '12/1 결제 예정'만 보였다(체험단 화면·포장 목록은 '보류').
   */
  const data = code('app', 'admin', 'users', '[id]', '_data.ts')
  assert.match(data, /loadChargeProjection\(admin, liveForPlan, \{[\s\S]{0,200}stopAtHold: false,/, '고객 화면 서포터즈 칸이 체험단 화면과 같은 회차 펼치기를 안 쓴다')
  assert.match(data, /trialPlanView\(proj\.roundsByUser\.get\(userId\) \?\? \[\], ctx\?\.consents \?\? \[\], today\)/, '인상 동의 상태가 정본(trialPlanView)이 아니다')
  assert.match(data, /from\('subscription_charge_holds'\)[\s\S]{0,120}\.is\('resolved_at', null\)/, '열린 청구 보류를 읽지 않는다')
  assert.match(data, /if \(!proj\.ok\) \{\s*errors\.trial_plan = proj\.error/, "회차 조회 실패를 '서포터즈 아님'으로 접는다(규칙1)")
  const view = code('app', 'admin', 'users', '[id]', 'CustomerView.tsx')
  assert.match(view, /\{data\.supporterPlan && <SupporterPlanBlock plan=\{data\.supporterPlan\} \/>\}/, '고객 화면에 서포터즈 인상·동의 칸이 없다')
  const block = view.slice(view.indexOf('function SupporterPlanBlock('), view.indexOf('function AllergyChips('))
  assert.match(block, /href="\/admin\/trials"/, '동의 기록하러 가는 링크(체험단 화면)가 없다')
  assert.match(block, /청구 보류 중/, '열린 보류를 보여 주지 않는다')
  assert.ok(!/sendAdminJson|fetch\(|method:/.test(block), '서포터즈 칸이 읽기 전용이 아니다(동의 기록은 체험단 화면 한 곳에서)')
})

test("규칙279: 챙길 손님 — 연락 수단 신호(옛 앱·알림 못 받음·메일 반송)는 정기배송·최근 30일 결제 손님에게만, 탈퇴 회원은 빼고", async () => {
  /**
   * # 왜 (조사 "'챙길 손님' 약 16명 중 정기배송 손님은 1명뿐")
   * 구독 없는 가입자·탈퇴 회원(탈퇴하면 알림 기기가 지워져 반드시 걸림)까지 '챙길 손님'이라 진짜 결제·배송 알림을 못 받는 손님이 묻혔다.
   * 운영 DB 실측(10/15): 고치기 전 18명 → 고친 뒤 2명(알림 못 받음 1·옛 앱 1, 거래 중 손님 7명 중).
   */
  const cf = await load<typeof import('./admin/customer-flags.ts')>('lib', 'admin', 'customer-flags.ts')
  const base = { email: 'a@kakao.com', suppressedEmails: new Set(['a@kakao.com']), nativeTokens: [], webPushCount: 0, subscriptions: [] }
  assert.deepEqual(cf.customerFlags(base).keys, [], '구독도 최근 결제도 없는 가입자를 챙길 손님으로 센다')
  assert.deepEqual(cf.customerFlags({ ...base, recentPaidOrders: 1 }).keys, ['no_push', 'bounced'], '최근 결제한 손님(웹 가게 포함)의 연락 수단 신호를 못 본다')
  const live = { status: 'active' as const, has_billing_key: true, next_delivery_date: '2026-10-20', failed_charge_count: 0, requires_billing_key_renewal: false }
  assert.deepEqual(cf.customerFlags({ ...base, subscriptions: [live] }).keys, ['no_push', 'bounced'], '정기배송 손님의 연락 수단 신호를 못 본다')
  assert.deepEqual(cf.customerFlags({ ...base, subscriptions: [{ ...live, status: 'cancelled' as const }] }).keys, [], '해지한 손님을 거래 중으로 센다')
  assert.deepEqual(cf.customerFlags({ ...base, subscriptions: [live], recentPaidOrders: 3, deleted: true }).keys, [], '탈퇴 회원을 챙길 손님으로 센다')
  assert.equal(cf.RECENT_PURCHASE_DAYS, 30)
  const ld = code('lib', 'admin', 'customer-flags-load.ts')
  assert.match(ld, /selectInChunks\(ids, \(chunk\) =>\s*admin\s*\.from\('orders'\)[\s\S]{0,160}\.gte\('created_at', recentSince\)/, '최근 결제를 읽지 않는다')
  assert.match(ld, /recentPaidOrders: recentByUser\.get\(u\.id\) \?\? 0,\s*deleted: !!u\.deleted_at,/, '판정에 최근 결제·탈퇴를 넘기지 않는다')
  assert.match(ld, /\.select\('id, email, name, phone, deleted_at'\)\s*[\s\S]{0,120}\.is\('deleted_at', null\)/, '회원 목록 챙길 손님 집계에 탈퇴 회원이 들어간다')
  assert.match(code('app', 'admin', 'users', '[id]', '_data.ts'), /loadCustomerFlags\(admin, \[\{ id: userId, email: prof\.email, deleted_at: prof\.deleted_at \}\]\)/, '고객 화면 챙길 신호가 탈퇴 여부를 모른다')
})
