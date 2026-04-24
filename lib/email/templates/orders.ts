/**
 * Farmer's Tail — 주문 라이프사이클 메일 템플릿.
 *
 * 각 함수는 {subject, html} 을 반환하기만 한다. 실제 전송은 상위 레이어
 * (lib/email/index.ts) 에서. 템플릿을 순수 함수로 유지하면 Playwright에서
 * 메일 바디 회귀 스냅샷도 찍기 쉬움.
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'
import { carrierLabel, carrierTrackerUrl } from '@/lib/tracking'
import { bankCodeLabel, formatDueDate } from '@/lib/payments/toss'

export type OrderEmailItem = {
  product_name: string
  quantity: number
  line_total: number
}

export type OrderEmailBase = {
  recipientName: string
  orderNumber: string
  orderId: string
  totalAmount: number
  items: OrderEmailItem[]
}

// ── 주문 접수 (결제 완료) ────────────────────────────────────────────────────
export function renderOrderConfirmation(
  input: OrderEmailBase & {
    shippingFee: number
    paymentMethodLabel: string
  },
): { subject: string; html: string } {
  const subject = `[파머스테일] 주문이 접수됐어요 · ${input.orderNumber}`
  const itemsRows = input.items.map((it) =>
    block.orderItem(it.product_name, it.quantity, it.line_total),
  )
  const summaryRows = [
    block.row('주문번호', `<span style="font-family:monospace;">${escape(input.orderNumber)}</span>`),
    block.row('결제 수단', escape(input.paymentMethodLabel)),
    block.row(
      '배송비',
      input.shippingFee === 0 ? '무료' : `${input.shippingFee.toLocaleString()}원`,
    ),
    block.row(
      '총 결제 금액',
      `<span style="color:#B5533A;font-size:14px;">${input.totalAmount.toLocaleString()}원</span>`,
    ),
  ]

  const html = renderLayout({
    kicker: 'Order Placed · 주문 접수',
    heading: `${input.recipientName}님, 주문이 접수됐어요`,
    icon: '🐾',
    preview: `총 ${input.totalAmount.toLocaleString()}원 주문이 접수되었어요`,
    body: `
      <p style="margin:0 0 16px 0;">
        주문이 정상적으로 접수되었어요. 상품 준비가 시작되면 다시 알려드릴게요.
      </p>
      <div style="margin-top:12px;">
        <div style="font-size:10px;color:#7A7A7A;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">주문 상품</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #E6DDC8;border-bottom:1px solid #E6DDC8;">${itemsRows.join('')}</table>
      </div>
      ${block.hr()}
      ${block.dl(summaryRows)}
    `,
    cta: {
      label: '주문 상세 보기',
      href: `${SITE_URL}/mypage/orders/${input.orderId}`,
    },
  })

  return { subject, html }
}

// ── 가상계좌 입금 대기 ────────────────────────────────────────────────────────
export function renderVirtualAccountWaiting(
  input: OrderEmailBase & {
    bankCode: string | null
    accountNumber: string
    accountHolder: string | null
    dueDate: string | null
  },
): { subject: string; html: string } {
  const subject = `[파머스테일] 입금을 기다리고 있어요 · ${input.orderNumber}`
  const bank = bankCodeLabel(input.bankCode) || '—'
  const due = input.dueDate ? formatDueDate(input.dueDate) : null
  const body = `
    <p style="margin:0 0 14px 0;">
      가상계좌가 발급됐어요. 아래 계좌로 <strong style="color:#1E1A14;">${input.totalAmount.toLocaleString()}원</strong>
      을 입금해 주세요. 입금이 확인되면 상품 준비를 시작해요.
    </p>
    ${block.callout(
      'gold',
      `
      ${block.dl([
        block.row('입금 은행', escape(bank)),
        block.row(
          '계좌번호',
          `<span style="font-family:monospace;font-size:13px;">${escape(input.accountNumber)}</span>`,
        ),
        ...(input.accountHolder ? [block.row('예금주', escape(input.accountHolder))] : []),
        ...(due ? [block.row('입금 기한', `<span style="color:#C44B3A;">${escape(due)}</span>`)] : []),
      ])}
    `,
    )}
    <p style="margin:16px 0 0 0;font-size:11px;color:#7A7A7A;">
      기한까지 입금되지 않으면 주문이 자동 취소돼요.
    </p>
  `
  const html = renderLayout({
    kicker: 'Awaiting Deposit · 입금 대기',
    heading: '입금을 기다리고 있어요',
    icon: '⏳',
    preview: `${input.totalAmount.toLocaleString()}원 가상계좌 입금을 기다리고 있어요`,
    body,
    cta: {
      label: '주문 상세 보기',
      href: `${SITE_URL}/mypage/orders/${input.orderId}`,
    },
  })
  return { subject, html }
}

// ── 배송 시작 ────────────────────────────────────────────────────────────────
export function renderOrderShipped(
  input: OrderEmailBase & {
    carrier: string | null
    trackingNumber: string | null
  },
): { subject: string; html: string } {
  const subject = `[파머스테일] 배송이 시작됐어요 📦 · ${input.orderNumber}`
  const carrierName = input.carrier ? carrierLabel(input.carrier) : null
  const trackerHref = carrierTrackerUrl(input.carrier, input.trackingNumber)
  const rows: string[] = [
    block.row('주문번호', `<span style="font-family:monospace;">${escape(input.orderNumber)}</span>`),
  ]
  if (carrierName) rows.push(block.row('택배사', escape(carrierName)))
  if (input.trackingNumber)
    rows.push(
      block.row(
        '송장번호',
        `<span style="font-family:monospace;">${escape(input.trackingNumber)}</span>`,
      ),
    )

  const body = `
    <p style="margin:0 0 14px 0;">
      주문하신 상품이 배송을 시작했어요. 아래 송장번호로 실시간 배송 상태를 확인하실 수 있어요.
    </p>
    ${block.dl(rows)}
    ${trackerHref
      ? `<p style="margin:16px 0 0 0;font-size:11px;color:#7A7A7A;">
         택배사 사이트에서 직접 조회하려면
         <a href="${escape(trackerHref)}" style="color:#B5533A;">여기</a> 를 눌러주세요.
       </p>`
      : ''}
  `
  const html = renderLayout({
    kicker: 'In Transit · 배송 시작',
    heading: '배송이 시작됐어요',
    icon: '📦',
    preview: carrierName
      ? `${carrierName} · ${input.trackingNumber ?? ''}`
      : '주문하신 상품이 배송을 시작했어요',
    body,
    cta: {
      label: '실시간 배송 조회',
      href: `${SITE_URL}/mypage/orders/${input.orderId}/track`,
    },
  })
  return { subject, html }
}

// ── 배송 완료 ────────────────────────────────────────────────────────────────
export function renderOrderDelivered(
  input: OrderEmailBase,
): { subject: string; html: string } {
  const subject = `[파머스테일] 배송이 완료됐어요 🐾 · ${input.orderNumber}`
  const body = `
    <p style="margin:0 0 14px 0;">
      주문하신 상품이 잘 도착했어요. 반려견이 맛있게 먹고 있길 바라요.
    </p>
    ${block.callout(
      'moss',
      `
      리뷰를 남겨주시면 <strong>500P</strong> 가 적립돼요. 반려견이 어떻게 반응했는지
      짧게 남겨주셔도 좋아요.
    `,
    )}
  `
  const html = renderLayout({
    kicker: 'Delivered · 배송 완료',
    heading: '주문이 잘 도착했어요',
    icon: '🐾',
    preview: `${input.orderNumber} 배송이 완료됐어요`,
    body,
    cta: {
      label: '리뷰 쓰고 500P 받기',
      href: `${SITE_URL}/mypage/orders/${input.orderId}`,
    },
  })
  return { subject, html }
}

// ── 주문 취소 (자동 / 고객 / 관리자 모두 공용) ─────────────────────────────
export function renderOrderCancelled(
  input: OrderEmailBase & {
    reason: string | null
    refundAmount: number | null
  },
): { subject: string; html: string } {
  const subject = `[파머스테일] 주문이 취소됐어요 · ${input.orderNumber}`
  const rows = [
    block.row('주문번호', `<span style="font-family:monospace;">${escape(input.orderNumber)}</span>`),
  ]
  if (input.reason) rows.push(block.row('사유', escape(input.reason)))
  if (input.refundAmount && input.refundAmount > 0) {
    rows.push(
      block.row(
        '환불 금액',
        `<span style="color:#C44B3A;">${input.refundAmount.toLocaleString()}원</span>`,
      ),
    )
  }

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님의 주문이 취소되었어요. 결제 금액은 3~5 영업일 내
      원 결제 수단으로 환불되고, 사용한 포인트와 쿠폰은 모두 환원돼요.
    </p>
    ${block.dl(rows)}
  `
  const html = renderLayout({
    kicker: 'Cancelled · 주문 취소',
    heading: '주문이 취소됐어요',
    icon: '✖',
    preview: `${input.orderNumber} 주문이 취소됐어요`,
    body,
    cta: {
      label: '주문 내역 보기',
      href: `${SITE_URL}/mypage/orders`,
    },
  })
  return { subject, html }
}

// ── 회원 가입 환영 ───────────────────────────────────────────────────────────
export function renderWelcome(input: {
  recipientName: string
}): { subject: string; html: string } {
  const subject = '[파머스테일] 반가워요, 가족이 되어주셔서 감사해요 🐾'
  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 반가워요! 파머스테일은 반려견이
      "이건 진짜 맛있다" 고 눈을 반짝이는 음식만 골라 담아요.
    </p>
    <p style="margin:0 0 14px 0;">
      가입 첫 구매 시 사용할 수 있는 <strong style="color:#B5533A;">5,000원 할인 쿠폰</strong>
      을 마이페이지에 담아뒀어요.
    </p>
  `
  const html = renderLayout({
    kicker: 'Welcome · 환영합니다',
    heading: '가족이 되어주셔서 감사해요',
    icon: '🐶',
    preview: '파머스테일에 가입해주셔서 감사해요. 가입 쿠폰이 기다리고 있어요.',
    body,
    cta: {
      label: '쿠폰 확인하기',
      href: `${SITE_URL}/mypage/coupons`,
    },
  })
  return { subject, html }
}
