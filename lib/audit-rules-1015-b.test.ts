/**
 * 2026-10-15 어드민 수정 갈래 F-b '할 일·고객 화면·폰' 의 규칙 270~289 (가지 fix/1015-todo-customer).
 *
 * 10/14 어드민 20관점 조사에서 나온 급한 것·10/14 배포 기능의 결함을 고친 것. 문서에만 적은 규칙은 같은 날 또 어긴다 —
 * 고친 것을 테스트로 박는다. 규칙마다 고친 코드를 일부러 되돌려 빨간불이 켜지는지 검산했다(카나리아 — 보고서에 결과).
 * if 안에 단언을 넣지 않는다(조건이 거짓이 되면 조용히 무단언이 된다).
 *
 *   270 10/16 서포터즈 첫 박스 체크인 — '잘 안 먹어요'·메모 있는 '조금 가렸어요'를 경보함·이번 주 할 일·고객 화면에,
 *       손님 문구는 지킬 수 있는 약속만('다음 박스에 반영' 금지), '잘 안 먹어요'면 카카오톡 문의 길
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
