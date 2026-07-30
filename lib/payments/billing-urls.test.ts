import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  billingRedirectUrls,
  billingAuthFallbackHref,
  billingReturnHref,
} from './billing-urls.ts'

/**
 * 이 규칙이 어긋나면 **결제가 조용히 깨진다.** 호출부가 두 곳(주문 화면 직행 ·
 * 등록 화면)이라 한쪽만 고치는 사고를 막기 위해 여기 고정한다.
 */

const BASE = {
  origin: 'https://www.farmerstail.kr',
  subscriptionId: '11111111-1111-4111-8111-111111111111',
  customerKey: '22222222-2222-4222-8222-222222222222',
} as const

test('★ successUrl 에 subscriptionId 와 method 가 둘 다 실린다', () => {
  const { successUrl } = billingRedirectUrls({ ...BASE, method: 'tosspay' })
  // subscriptionId 가 없으면 어느 구독에 붙일지 모른다 → 등록이 유실된다.
  assert.match(successUrl, /subscriptionId=11111111-1111-4111-8111-111111111111/)
  // method 가 없으면 토스페이 등록이 '카드'로 저장돼 화면에 이름이 안 뜬다.
  assert.match(successUrl, /method=tosspay/)
  assert.ok(successUrl.startsWith('https://www.farmerstail.kr/subscribe/billing-success?'))
})

test('★ failUrl 에 customerKey 가 실린다 — 없으면 재시도가 막다른 길', () => {
  // 2026-07-03 감사: 이 키 없이 billing-auth 로 돌아오면 '잘못된 접근' 이 뜬다.
  const { failUrl } = billingRedirectUrls({ ...BASE, method: 'card' })
  assert.match(failUrl, /customerKey=22222222-2222-4222-8222-222222222222/)
  assert.match(failUrl, /subscriptionId=11111111/)
})

test('failUrl 에는 method 를 싣지 않는다 — 실패 후엔 다시 고를 수 있어야', () => {
  const { failUrl } = billingRedirectUrls({ ...BASE, method: 'tosspay' })
  assert.equal(failUrl.includes('method='), false)
})

test('토스가 쿼리를 덧붙일 수 있게 successUrl·failUrl 이 이미 ? 를 갖는다', () => {
  // 토스는 authKey·customerKey 를 & 로 이어 붙인다. ? 가 없으면 주소가 깨진다.
  const u = billingRedirectUrls({ ...BASE, method: 'card' })
  assert.ok(u.successUrl.includes('?'))
  assert.ok(u.failUrl.includes('?'))
})

test('수단마다 successUrl 의 method 만 달라진다', () => {
  const card = billingRedirectUrls({ ...BASE, method: 'card' })
  const toss = billingRedirectUrls({ ...BASE, method: 'tosspay' })
  assert.match(card.successUrl, /method=card/)
  assert.match(toss.successUrl, /method=tosspay/)
  assert.equal(card.failUrl, toss.failUrl) // failUrl 은 수단과 무관
})

test('값에 특수문자가 섞여도 인코딩된다', () => {
  const u = billingRedirectUrls({
    ...BASE,
    subscriptionId: 'a&b=c',
    customerKey: 'x y/z',
    method: 'card',
  })
  assert.match(u.successUrl, /subscriptionId=a%26b%3Dc/)
  assert.match(u.failUrl, /customerKey=x%20y%2Fz/)
})

test('폴백 주소는 등록 화면 + 두 키 (선택 화면이 뜨도록 method 없음)', () => {
  const href = billingAuthFallbackHref(BASE)
  assert.ok(href.startsWith('/subscribe/billing-auth?'))
  assert.match(href, /subscriptionId=11111111/)
  assert.match(href, /customerKey=22222222/)
  assert.equal(href.includes('method='), false)
})

test('billingReturnHref — 웹과 앱이 서로 다른 화면으로 간다', () => {
  // 이 함수가 생긴 이유: /subscribe/* 세 화면이 top-level(웹+앱 공용)인데
  // 돌아가는 링크가 전부 앱 전용 경로였다 → 웹 사용자는 '/app-required' 벽.
  assert.equal(billingReturnHref(true), '/mypage/subscriptions')
  assert.equal(billingReturnHref(false), '/account/subscriptions')
})

test('★ 웹 목적지는 앱 전용 경로가 아니다 (proxy.ts 와 대조)', () => {
  // proxy.ts 의 APP_ONLY_PREFIXES 를 **실제로 읽어** 대조한다. 목록에 경로가
  // 추가되면 여기서 깨진다 — 손으로 적은 기대값이면 조용히 낡는다.
  const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
  // `= [` 로 앵커해야 한다 — `: readonly string[] =` 의 `[]` 가 먼저 잡히면
  // 캡처가 비어 목록이 0개가 되고, 그러면 "위반 없음"으로 조용히 통과한다.
  const block = /APP_ONLY_PREFIXES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(proxy)
  assert.ok(block?.[1], 'proxy.ts 에서 APP_ONLY_PREFIXES 를 못 찾았다')
  const prefixes = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  assert.ok(prefixes.length > 0, '앱 전용 prefix 목록이 비어 있다')

  const webHref = billingReturnHref(false)
  const blocked = prefixes.filter((p) => webHref.startsWith(p))
  assert.deepEqual(
    blocked,
    [],
    `웹 사용자를 앱 전용 경로로 보내고 있다: ${webHref} (${blocked.join(', ')})`,
  )
})
