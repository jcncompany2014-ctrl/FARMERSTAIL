import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderSubscriptionReminder, renderTrialPriceChange } from './templates/subscription.ts'
import { renderOrderConfirmation } from './templates/orders.ts'

/**
 * 메일 템플릿을 **실제로 렌더해서** 검증한다 (2026-08-08 테스트 감사).
 *
 * # 왜 여태 없었나
 * `lib/email` 트리가 확장자 없는 상대 import 를 쓰고 있어서
 * `npm test`(node --experimental-strip-types)가 **모듈을 못 찾았다** —
 * 템플릿을 import 하는 순간 ERR_MODULE_NOT_FOUND 로 죽었다.
 * 그래서 규칙16·45·honorific 이 전부 **파일을 텍스트로 grep** 하는 우회를
 * 쓰고 있었다. 그게 취향이 아니라 증상이었다.
 *
 * 확장자를 붙여 트리를 열었으니, 이제 실제 출력에 대해 단언한다.
 * 거래 메일 본문은 법정 고지가 실리는 표면이다.
 */
describe('메일 렌더 — 실제 출력', () => {
  const orderBase = {
    orderId: 'o1',
    orderNumber: 'FT-20260808-0001',
    recipientName: '김철수',
    totalAmount: 153100,
    shippingFee: 0,
    paymentMethodLabel: '카드',
    items: [{ product_name: '소고기 화식', quantity: 1, line_total: 153100 }],
  }

  it('정기배송 리마인더 — 발송일을 "도착"이라 부르지 않는다', () => {
    const { html, subject } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-08-11',
      daysBefore: 1,
      items: [{ productName: '소고기 화식', quantity: 1 }],
    })
    assert.ok(!html.includes('도착 예정'), '발송일을 "도착 예정"이라 썼다')
    assert.ok(html.includes('발송 예정'))
    // 제목("출발해요")과 본문이 같은 말을 해야 한다.
    assert.ok(!subject.includes('도착'))
  })

  it('★정기배송 리마인더 — 품목을 "0원"으로 그리지 않는다', () => {
    // 2026-09-01 감사: block.orderItem(..., 0) 을 쓰고 있어 **모든 품목이 0원**으로
    // 렌더됐다. 금액 열이 없는 블록으로 바꿨고, 실제 청구액은 콜아웃이 말한다.
    const { html } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-09-01',
      daysBefore: 2,
      items: [
        { productName: '프레시 치킨 레시피', quantity: 1 },
        { productName: '프레시 흑돼지 레시피', quantity: 1 },
      ],
      chargeAmount: 37200,
    })
    // ⚠️ `html.includes('0원')` 로 쓰면 안 된다 — "37,200원" 에도 "0원" 이 들어간다.
    //    버그의 실제 모양은 **셀 내용이 통째로 "0원"** 인 것이라 그걸 본다.
    assert.doesNotMatch(html, />\s*0원\s*</, '품목가가 "0원"으로 렌더됐다')
    assert.ok(html.includes('프레시 치킨 레시피'), '품목명이 빠졌다')
  })

  it('★정기배송 리마인더 — 결제 금액·시점·해지 마감을 고지한다 (정기결제 사전고지)', () => {
    const { html } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-09-01',
      daysBefore: 2,
      items: [{ productName: '프레시 치킨 레시피', quantity: 1 }],
      chargeAmount: 37200,
    })
    assert.ok(html.includes('37,200원'), '청구 금액이 없다')
    assert.match(html, /결제/, '결제된다는 사실이 없다')
    assert.match(html, /해지|미루/, '해지·미루기 안내가 없다')
  })

  it('금액을 모르면 틀린 금액을 말하느니 금액 문장을 뺀다', () => {
    const { html } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-09-01',
      daysBefore: 2,
      items: [{ productName: '프레시 치킨 레시피', quantity: 1 }],
      chargeAmount: null,
    })
    assert.doesNotMatch(html, />\s*0원\s*</, '금액 미상인데 0원이라고 썼다')
    assert.match(html, /자동 결제돼요/, '결제 사실 고지까지 사라지면 안 된다')
  })

  it('호칭이 두 번 붙지 않는다', () => {
    const { html } = renderOrderConfirmation({
      ...orderBase,
      recipientName: '김철수님',
    })
    assert.ok(!html.includes('님님'), '"님님" 이 나왔다')
  })

  it('영문 이름엔 님을 붙이지 않는다', () => {
    const { html } = renderOrderConfirmation({
      ...orderBase,
      recipientName: 'John',
    })
    assert.ok(!html.includes('John님'), '"John님" 이 나왔다')
    assert.ok(html.includes('John'))
  })

  it('사업자 정보와 수신거부 링크가 모든 거래 메일에 실린다', () => {
    const { html } = renderOrderConfirmation({ ...orderBase })
    // 전자상거래법 §10 — 상호·사업자등록번호
    assert.match(html, /파머스테일/)
    assert.match(html, /243-06-03606/)
    assert.match(html, /account\/notifications/)
  })

  it('HTML escape — 이름에 태그를 넣어도 그대로 나가지 않는다', () => {
    const { html } = renderOrderConfirmation({
      ...orderBase,
      recipientName: '<script>alert(1)</script>',
    })
    assert.ok(!html.includes('<script>'), 'script 태그가 그대로 실렸다')
  })
})

// ── 2026-10-01 일정 변경 — 토·일 조리 → 화 발송, 일반 고객은 토요일(조리 직전) 결제 ────────────────────
describe('결제 전 고지 · 서포터즈 전환 고지 — 결제일과 발송일을 따로 말한다', () => {
  it('★토요일 결제·화요일 발송 — 두 날짜를 다 말하고, 결제 사실이 제목에 있다', () => {
    const { html, subject } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-10-13',
      chargeDate: '2026-10-10',
      daysBefore: 2,
      items: [{ productName: '흑돼지 화식', quantity: 14 }],
      chargeAmount: 32700,
    })
    assert.match(subject, /결제/, '제목에 결제 사실이 없다')
    assert.match(html, /10월 10일 토요일 아침에 32,700원이 결제돼요/, '결제일(토)·금액이 없다')
    assert.match(html, /10월 13일 화요일 발송 예정/, '발송일(화)이 없다')
    assert.match(html, /조리를 시작하기 전/, '왜 발송 전에 결제되는지 말하지 않는다')
    assert.ok(!html.includes('도착'), '도착을 약속했다')
  })
  it('서포터즈 체험 구간(결제일 = 발송일) — "같은 날 보내드려요", 토요일 이야기는 없다', () => {
    const { html } = renderSubscriptionReminder({
      recipientName: '김철수',
      nextDeliveryDate: '2026-10-06',
      chargeDate: '2026-10-06',
      daysBefore: 2,
      items: [{ productName: '오리고기 화식', quantity: 14 }],
      chargeAmount: 100,
    })
    assert.match(html, /같은 날 보내드려요/)
    assert.ok(!html.includes('토요일'), '서포터즈에게 토요일 결제를 말했다(사장님: 정상가 전까지 알리지 않는다)')
  })
  it('★서포터즈 정상가 전환 고지 — 결제가 발송 전 토요일로 바뀐다는 사실을 처음 알린다', () => {
    const { html } = renderTrialPriceChange({
      recipientName: '김철수',
      nextPhase: 'full',
      nextChargeDate: '2026-11-28',
      nextShipDate: '2026-12-01',
      nextAmount: 32200,
    })
    assert.match(html, /11월 28일 토요일 아침에 32,200원이 결제돼요/)
    assert.match(html, /12월 0?1일 화요일에 보내드려요/)
    assert.match(html, /조리를 시작하기 전/)
  })
  it('반값 전환 고지(아직 체험 중 — 발송일 결제)엔 결제 시점 변경 문장이 없다', () => {
    const { html } = renderTrialPriceChange({
      recipientName: '김철수',
      nextPhase: 'half',
      nextChargeDate: '2026-11-03',
      nextShipDate: '2026-11-03',
      nextAmount: 16100,
    })
    assert.ok(!html.includes('토요일'), '반값 구간 서포터즈에게 토요일 결제를 말했다')
  })
})
