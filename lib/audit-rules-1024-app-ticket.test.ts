/**
 * 2026-10-24 규칙 315 — 앱 '다음 결제' 카드 영수증 꼴 + 홈 박스 카드 팩 사진 스티커(사장님 시안 승인 "앱도 시안대로 변경해").
 *
 * 사장님 "앱에 정기배송 화면 부분에 나오는 다음 결제 정보 카드랑 홈 화면 디자인도 업그레이드가 더 필요" — 금액만 있던 색 상자에
 * 결제일·결제수단·이번 박스·하루 금액·바꿀 수 있는 마감을 영수증처럼 붙이고, 홈 박스 카드엔 박스에 든 팩 사진을 붙였다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙315: 다음 결제 카드 — 결제일·결제수단·이번 박스·하루 + 마감은 미루기 시트와 같은 계산', () => {
  const c = code('app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')
  for (const k of ["k: '결제일'", "k: '결제수단'", "k: '하루'"]) assert.ok(c.includes(k), `영수증 줄이 빠졌다: ${k}`)
  assert.match(c, /k: inProgress \? '그다음 박스' : '이번 박스'/, '결제된 박스가 있을 때 다음 결제가 어느 박스인지 말하지 않는다')
  // 마감 = 원래 발송일의 신청 마감 — 미루기 시트의 되돌리기 마감(undoUntil)과 같은 식이어야 두 화면이 다른 날을 말하지 않는다
  assert.match(c, /const deadlineIso = nextShip && timing && !overdue \? addDaysKst\(nextShip, -leadDaysFor\(timing\)\) : null/, '마감 계산이 미루기 시트와 다르다')
  assert.match(c, /undoUntil=\{addDaysKst\(fromIso, -leadDaysFor\(chargeTiming \?\? 'before_cooking'\)\)\}/, '미루기 시트의 마감 계산이 바뀌었다 — 카드 마감과 같이 바꿀 것')
  // 팩 개수는 말하지 않는다(하루 100g 넘는 아이는 실제 팩이 화면 수의 두 배) — '14일치'로만
  assert.ok(!/팩`/.test(c.slice(c.indexOf('const ticket'), c.indexOf('const noteNode'))), '영수증 줄에 팩 개수가 들어갔다(실제 팩 수와 다를 수 있다)')
  assert.ok(c.includes('`${recipeText} · 14일치`'), "이번 박스 줄이 '14일치'가 아니다")
  // 지난 결제일엔 며칠 뒤·마감을 말하지 않는다
  assert.match(c, /const n = chargeIso && !overdue \? diffDaysKst\(chargeIso, today\) : null/, '지난 결제일에도 며칠 뒤를 말한다')
  assert.ok(c.includes("state === 'active' && (chargeIso || nextShip)"), '진행 중이 아닌 구독(일시정지·카드 등록 전)에도 영수증이 뜬다')
})

test('규칙315: 홈 박스 카드 팩 사진 — 스튜디오 팩 사진 정본만(규칙289), 두 카드가 같은 부품', () => {
  const st = code('components', 'v3', 'home', 'PouchStickers.tsx')
  assert.match(st, /studioPouchImage\(PROTEIN\[l\]\)/, '팩 스티커가 스튜디오 팩 사진 정본(studioPouchImage)을 안 쓴다')
  assert.ok(!/\/pkg\/|pouch-ft|meal-recipe|\/bowl\//.test(st), '팩 스티커에 금지된 사진(겉봉투·옛 폰 스냅샷·그릇)이 들어갔다')
  assert.ok(!/loading=["']lazy/.test(st), '앱 사진에 lazy 를 걸었다(앱 사진 규칙)')
  assert.match(code('components', 'v3', 'home', 'BoxProgressCard.tsx'), /<PouchStickers lines=\{lines\} \/>/, '홈 박스 카드에 팩 사진이 없다')
  assert.match(code('components', 'v3', 'home', 'DeliveryStripCard.tsx'), /<PouchStickers lines=\{lines\.slice\(0, 1\)\} size=\{52\} \/>/, '다음 정기배송 띠에 팩 사진이 없다')
})
