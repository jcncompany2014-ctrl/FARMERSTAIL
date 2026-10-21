/**
 * 2026-10-21 사장님 B안 — 서포터즈(100원·반값) 기간에 금액 변경 제안이 가면 동의 창·푸시가 '정상가 A → B'만 말해 당장 더 내는 줄 안다.
 * 창·푸시가 "지금 내는 금액은 그대로 · 반값은 X → Y · 끝나면 A → B"를 먼저 말한다. 숫자는 청구와 같은 trialPricing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { trialConsentLines } from './payments/trial.ts'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')

test('규칙310: 서포터즈 기간 금액 변경 풀이 — 낑콩이(100원 2번·반값 4번, 32,200 → 35,400)', () => {
  const t = trialConsentLines({ cheap_remaining: 2, half_remaining: 4, cheap_price: 100, half_rate: 0.5 }, 32_200, 35_400)
  assert.ok(t)
  assert.equal(t.head, '서포터즈 기간이라 지금 내는 금액은 그대로예요')
  assert.deepEqual(t.lines, ['남은 2번은 지금처럼 박스당 100원이에요', '그다음 반값 4번은 16,100원 → 17,700원', '서포터즈 기간이 끝나면 32,200원 → 35,400원'])
  const half = trialConsentLines({ cheap_remaining: 0, half_remaining: 3, cheap_price: 100, half_rate: 0.5 }, 32_200, 35_400)
  assert.equal(half?.head, '서포터즈 반값 기간이에요')
  assert.equal(half?.lines[0], '남은 반값 3번은 16,100원 → 17,700원')
  assert.equal(trialConsentLines({ cheap_remaining: 0, half_remaining: 0, cheap_price: 100, half_rate: 0.5 }, 1, 2), null)
  assert.equal(trialConsentLines(null, 1, 2), null)
})

test('규칙310: 동의 창(앱·웹 둘 다)이 풀이를 그리고, 두 화면이 서포터즈 상태를 넘기고, 100원 기간 푸시가 금액 그대로를 먼저 말한다', () => {
  const modal = read('app', 'account', 'subscriptions', 'PriceChangeConsentModal.tsx')
  assert.equal((modal.match(/<TrialNote proposal=\{proposal\}/g) ?? []).length, 2, '앱·웹 모양 중 한쪽에 서포터즈 풀이가 없다')
  assert.match(modal, /trialConsentLines\(proposal\.trial, proposal\.priceFrom, proposal\.priceTo\)/)
  assert.match(read('app', '(main)', 'mypage', 'subscriptions', 'page.tsx'), /priceTo: hit\.formula\.priceChange\.to,[\s\S]{0,120}trial,/)
  assert.match(read('app', 'account', 'subscriptions', 'page.tsx'), /trial: await getTrialState\(user\.id\)/)
  const cron = read('app', 'api', 'cron', 'personalization-progression', 'route.ts')
  assert.match(cron, /const trialCheap = !!trialNow && trialNow\.cheap_remaining > 0/)
  assert.match(cron, /서포터즈 기간이라 지금 내는 금액은 그대로예요/)
})
