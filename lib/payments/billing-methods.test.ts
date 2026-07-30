import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  availableBillingMethods,
  billingBrandLabel,
  billingMethod,
  billingMethodFlags,
  billingMethodSummary,
  resolveBillingMethod,
} from './billing-methods.ts'

/**
 * 토스페이 자동결제 추가 (2026-07-30). 이 테스트가 지키는 것 두 가지:
 *  ① 플래그가 꺼져 있으면 토스페이는 어떤 경로로도 열리지 않는다 (계약 전
 *     노출 = 고객이 결제 실패를 만난다).
 *  ② 토스페이는 카드번호(last4)가 없다 — 그걸 '등록 전'으로 오판하면 이미
 *     등록한 고객이 등록 화면으로 무한히 돌려보내진다.
 */

const OFF = { tosspay: false }
const ON = { tosspay: true }

test('★ 환경변수를 안 넣으면 토스페이가 켜져 있다 (기본 켜짐)', () => {
  // 옵트인으로 뒀다가 Vercel 환경변수를 잊으면 운영에서 조용히 사라진다.
  // 사장님 계약 확인 완료(2026-07-30) → 기본 켜짐이 정상 상태.
  delete process.env.NEXT_PUBLIC_TOSSPAY_BILLING
  assert.deepEqual(billingMethodFlags(), { tosspay: true })
})

test("비상 스위치 — 'off' 를 명시하면 꺼진다", () => {
  process.env.NEXT_PUBLIC_TOSSPAY_BILLING = 'off'
  assert.deepEqual(billingMethodFlags(), { tosspay: false })
  process.env.NEXT_PUBLIC_TOSSPAY_BILLING = 'on'
  assert.deepEqual(billingMethodFlags(), { tosspay: true })
  delete process.env.NEXT_PUBLIC_TOSSPAY_BILLING
})

test('플래그 꺼짐 — 수단은 카드 하나 (기존 흐름과 동일)', () => {
  const list = availableBillingMethods(OFF)
  assert.deepEqual(
    list.map((m) => m.id),
    ['card'],
  )
})

test('플래그 켜짐 — 카드가 먼저, 토스페이가 뒤', () => {
  const list = availableBillingMethods(ON)
  assert.deepEqual(
    list.map((m) => m.id),
    ['card', 'tosspay'],
  )
})

test('★ 기존 진입점 5곳은 method 를 안 싣는다 → 카드로 낙하', () => {
  // null·undefined·빈 문자열 전부 카드. 하나라도 어긋나면 '잘못된 접근'이 된다.
  for (const raw of [null, undefined, '']) {
    assert.equal(resolveBillingMethod(raw, ON).id, 'card')
    assert.equal(resolveBillingMethod(raw, OFF).id, 'card')
  }
})

test('★ 플래그 꺼진 상태에서 ?method=tosspay 를 손으로 붙여도 카드로 막힌다', () => {
  assert.equal(resolveBillingMethod('tosspay', OFF).id, 'card')
})

test('플래그 켜짐 — tosspay 요청이 그대로 통한다', () => {
  assert.equal(resolveBillingMethod('tosspay', ON).id, 'tosspay')
})

test('모르는 값은 카드로 낙하 (에러 대신 안전한 기본값)', () => {
  for (const raw of ['CARD', 'naverpay', 'kakaopay', '토스페이', '../etc']) {
    assert.equal(resolveBillingMethod(raw, ON).id, 'card')
  }
})

test('토스페이 등록창 파라미터 — DIRECT + TOSSPAY 여야 자체창이 열린다', () => {
  // flowMode 가 DEFAULT(기본)면 토스페이 창이 아니라 통합 카드창이 열린다.
  assert.deepEqual(billingMethod('tosspay').params, {
    method: 'CARD',
    flowMode: 'DIRECT',
    easyPay: 'TOSSPAY',
  })
})

test('카드 등록창 파라미터 — flowMode 를 넣지 않는다(기본 카드창)', () => {
  assert.deepEqual(billingMethod('card').params, { method: 'CARD' })
})

test('브랜드 이름 — 토스가 카드사를 주면 그걸 쓴다', () => {
  assert.equal(billingBrandLabel('card', '현대'), '현대')
  assert.equal(billingBrandLabel('tosspay', '현대'), '현대')
})

test('브랜드 이름 — 토스가 안 주면 토스페이는 수단 이름으로 대체', () => {
  assert.equal(billingBrandLabel('tosspay', null), '토스페이')
  assert.equal(billingBrandLabel('tosspay', '   '), '토스페이')
  // 카드는 대체 이름이 없다 — 화면이 '카드'로 자체 처리한다.
  assert.equal(billingBrandLabel('card', null), null)
})

test('★ 재현 케이스: 토스페이로 등록한 고객이 "등록 전"으로 보이면 안 된다', () => {
  // 이 버그의 실제 증상: 카드 등록 화면으로 무한히 돌려보내짐.
  const summary = billingMethodSummary({
    registered: true,
    brand: '토스페이',
    last4: null,
  })
  assert.equal(summary, '토스페이')
  assert.notEqual(summary, null)
})

test('카드 등록 고객은 카드사 + 끝 4자리', () => {
  assert.equal(
    billingMethodSummary({ registered: true, brand: '현대', last4: '1234' }),
    '현대 ····1234',
  )
})

test('카드사 이름이 비어도 끝 4자리가 있으면 "카드"로 보여준다', () => {
  assert.equal(
    billingMethodSummary({ registered: true, brand: null, last4: '1234' }),
    '카드 ····1234',
  )
})

test('빌링키가 없으면 null — 화면이 "등록 전"을 그린다', () => {
  assert.equal(
    billingMethodSummary({ registered: false, brand: '현대', last4: '1234' }),
    null,
  )
})
