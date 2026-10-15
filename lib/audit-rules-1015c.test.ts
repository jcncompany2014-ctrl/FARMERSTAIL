/**
 * 2026-10-15 첫 박스 체크인 다듬기(사장님 "세개 ㄱㄱ") — 규칙 282~284.
 *
 *   282 손님 체크인 알림 제목에 이모지를 넣지 않는다(체크인 화면에서 🐾 를 뺀 앱 시안 결정과 같게)
 *   283 메모 칸 예시 = 사장님이 고른 세 가지(변 상태·가려움·잘 먹어요 — 10/15 결정, 광고에 옮길 땐 따로 판단)
 *   284 '잘 안 먹어요'는 사장님 폰에 바로 — 잠금 화면이라 이름·메모 없이, 한 번만(답한 지 1시간 안 + 경보 첫 생성), 관리자 목록 정본
 *
 * 고친 코드를 일부러 되돌려 빨간불을 검산했다. if 안에 단언을 넣지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

/** 이모지(그림 문자) — 한글·영문·문장부호는 걸리지 않는다. */
const EMOJI_RE = /\p{Extended_Pictographic}/u

test('규칙282: 첫 박스 체크인 손님 알림 제목·내용에 이모지가 없다', () => {
  const src = code('app', 'api', 'cron', 'first-box-checkin', 'route.ts')
  const title = /title:\s*`([^`]*)`/.exec(src)?.[1] ?? ''
  const body = /body:\s*'([^']*)'/.exec(src)?.[1] ?? ''
  assert.match(title, /어떠신가요\?$/, '체크인 알림 제목이 바뀌었거나 찾지 못했다')
  assert.ok(body.length > 0, '체크인 알림 내용을 찾지 못했다')
  assert.ok(!EMOJI_RE.test(title), `체크인 알림 제목에 이모지가 있다: ${title}`)
  assert.ok(!EMOJI_RE.test(body), `체크인 알림 내용에 이모지가 있다: ${body}`)
})

test('규칙283: 첫 박스 체크인 메모 칸 예시 = 사장님이 고른 세 가지(10/15)', () => {
  /**
   * 사장님 결정(2026-10-15): "변 상태가 좋아졌어요 / 가려움이 줄었어요 / 너무 잘 먹어요". 손님 의견 칸이라 그대로 둔다.
   * 이 답을 나중에 광고·후기 화면에 옮길 때는 건강 효과 문장을 그대로 인용하지 않는다(사료 효능 표시 — 그때 따로 판단).
   */
  const src = code('app', '(main)', 'dogs', '[id]', 'first-checkin', 'FirstCheckinClient.tsx')
  const placeholder = /placeholder="([^"]*)"/.exec(src)?.[1] ?? ''
  assert.equal(placeholder, '예: 변 상태가 좋아졌어요 / 가려움이 줄었어요 / 너무 잘 먹어요', '메모 칸 예시가 사장님이 고른 문구와 다르다')
})

test("규칙284: '잘 안 먹어요'는 사장님 폰에 바로 — 이름·메모 없이, 한 번만, 관리자 목록 정본", () => {
  const src = code('app', '(main)', 'dogs', '[id]', 'first-checkin', 'actions.ts')
  // 관리자 목록은 아침 브리핑과 같은 정본(service_role 전용 RPC) — 쿠키 클라이언트로는 못 부른다(규칙8).
  assert.match(src, /createAdminClient\(\)[\s\S]*?\.rpc\('admin_user_ids'\)/, "관리자 목록을 정본(admin_user_ids, service_role)으로 찾지 않는다")
  assert.match(src, /pushToUser\(a\.id,/, '관리자에게 푸시를 보내지 않는다')
  // '잘 안 먹어요'일 때만.
  assert.match(src, /if \(alert\.kind === 'feeding\.first_checkin_poor'\)\s*\{[\s\S]*?pushOwnerNow\(/, "'잘 안 먹어요'일 때 사장님 즉시 알림을 부르지 않는다")
  // 한 번만 — 답한 지 1시간 안 + 경보가 처음 생긴 때(횟수 1).
  assert.match(src, /OWNER_PUSH_WINDOW_MS\s*=\s*60 \* 60 \* 1000/, '즉시 알림 시간 창(1시간)이 없다')
  assert.match(src, /Date\.now\(\) - new Date\(answeredAt\)\.getTime\(\) > OWNER_PUSH_WINDOW_MS\) return/, '오래된 답에도 즉시 알림이 다시 울릴 수 있다')
  assert.match(src, /occurrences !== 1\) return/, '같은 강아지 경보가 이미 있어도(다시 부르면) 또 울린다')
  // 잠금 화면 — 제목·내용은 고정 문구(강아지·고객 이름, 메모를 끼워 넣지 않는다).
  const push = /pushToUser\(a\.id, \{([\s\S]*?)\}\)/.exec(src)?.[1] ?? ''
  const title = /title:\s*("[^"]*"|'[^']*')/.exec(push)?.[1] ?? ''
  const body = /body:\s*("[^"]*"|'[^']*')/.exec(push)?.[1] ?? ''
  assert.ok(title.length > 2 && body.length > 2, '사장님 즉시 알림의 제목·내용이 고정 문구가 아니다(이름·메모를 끼워 넣을 수 있다)')
  assert.match(push, /url: `\/admin\/users\/\$\{customerId\}#dogs`/, '누르면 그 고객 화면(강아지 칸)으로 가지 않는다')
  // 알림 실패가 손님 답·경보를 깨지 않는다.
  assert.match(src, /try \{\s*await pushOwnerNow\([\s\S]*?\} catch/, '즉시 알림 예외가 손님 동작까지 깨뜨릴 수 있다')
})
