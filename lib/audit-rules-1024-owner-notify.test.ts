/**
 * 2026-10-24 규칙 312 — 새 주문은 사장님 폰에 **바로** 간다.
 *
 * 10/21·10/23 첫 정기배송 두 건이 들어왔는데 사장님 폰엔 아무것도 안 떴다("오늘 구독 주문 들어왔는데 핸드폰에 알림도 안 뜨고").
 * 사장님께 가는 건 아침 9:40 브리핑 하나뿐이었고 새 주문 그 순간 알리는 길은 처음부터 없었다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙312: 새 정기배송·주문 결제·토요일 결제 결과가 사장님 폰에 바로 간다(손님 흐름은 막지 않는다)', () => {
  const lib = code('lib', 'admin', 'notify-admins.ts')
  // 받는 사람 = 정본 admin_user_ids · 카테고리 없음(조용시간·마케팅 선호에 안 걸림)
  assert.match(lib, /rpc\('admin_user_ids'\)/, '사장님 알림 수신자가 정본(admin_user_ids)이 아니다')
  assert.match(lib, /pushToUser\(a\.id, notice\)/, '사장님 알림에 카테고리가 붙었다(조용시간·선호에 걸려 안 갈 수 있다)')
  // 손님 흐름을 막지 않는다: 시간 제한 + try/catch
  assert.match(lib, /Promise\.race\(/, '사장님 알림에 시간 제한이 없다 — 푸시가 늦으면 손님 화면이 기다린다')
  assert.match(lib, /\} catch \(e\) \{/, '사장님 알림 실패가 손님 요청을 깨뜨릴 수 있다(try/catch 없음)')

  const issue = code('app', 'api', 'payments', 'billing-issue', 'route.ts')
  assert.match(issue, /if \(!cur\?\.next_delivery_date && firstDeliveryIso\) \{[\s\S]{0,900}notifyAdmins\(\s*newSubscriptionNotice\(/, '첫 카드 등록(새 정기배송) 때 사장님 알림이 없다')
  // 알림은 저장 성공 뒤에만(저장 실패를 '새 주문'으로 알리지 않는다)
  assert.ok(issue.indexOf('newSubscriptionNotice(') > issue.indexOf("if (saveErr) {"), '새 정기배송 알림이 카드 저장 확인보다 앞에 있다')

  // 2026-10-24 어드민 금액 말 정리 — 정가가 아니라 할인까지 넣은 첫 결제 금액(화면·청구와 같은 함수). 조회는 error 를 꺼내고,
  // 계산이 실패·지연돼도 알림은 금액 없이 나간다(손님 '등록 완료'를 막지 않는다).
  const factsAt = issue.indexOf('async function newSubNoticeFacts(')
  assert.ok(factsAt > 0, '새 정기배송 알림이 첫 결제 금액을 내지 않는다')
  const facts = issue.slice(factsAt)
  assert.match(facts, /resolveAutoDiscount\(\{ userId: i\.userId, subtotal: total, subscriptionId: i\.subscriptionId \}\)/, '첫 결제 금액이 청구와 같은 함수(resolveAutoDiscount, 구독 id 와 함께)가 아니다')
  assert.ok(!/const \[\{ data: \w+ \}/.test(issue) && !/\{ data: subRow \}/.test(issue), '새 정기배송 알림 조회가 error 를 안 꺼낸다(규칙1)')
  assert.match(facts, /if \(subRes\.error\) \{[\s\S]{0,160}return\s*\}/, '금액 조회 실패를 금액 0·정가로 그린다(규칙1)')
  assert.match(facts, /Promise\.race\(\[run\(\), new Promise<void>/, '첫 결제 금액 계산에 시간 한도가 없다 — 손님 등록 완료가 기다린다')
  assert.match(facts, /\} catch \(e\) \{/, '첫 결제 금액 계산 실패가 손님 요청을 깨뜨릴 수 있다')
  const notice = lib.slice(lib.indexOf('export function firstChargeText('), lib.indexOf('export function newSubscriptionNotice('))
  assert.match(notice, /`첫 결제 \$\{won\(i\.firstChargeAmount\)\}\(\$\{adminDiscountLabel\(i\.discountReason\)\} · 정가 \$\{won\(i\.listAmount\)\}\)`/, "알림이 '첫 결제 ○원(할인 이름 · 정가 ○원)'이 아니다")
  assert.match(notice, /첫 결제 금액 확인 못 함/, "금액을 못 냈을 때 '확인 못 함'이라고 말하지 않는다")
  assert.ok(!lib.includes('`2주 ${'), "알림이 아직 '2주 정가'를 보낸다(서포터즈 100원도 정가로 온다)")

  const confirm = code('app', 'api', 'payments', 'confirm', 'route.ts')
  assert.match(confirm, /if \(isActuallyPaid\) \{\s*await notifyAdmins\(/, '주문 결제 완료 때 사장님 알림이 없다')

  const charge = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  assert.match(charge, /if \(tried > 0\) \{\s*await notifyAdmins\(/, '토요일 결제 결과를 사장님께 바로 알리지 않는다')
})
