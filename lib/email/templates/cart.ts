/**
 * Farmer's Tail — 장바구니 재결제 유도 메일.
 *
 * 트리거: cron 이 카트에 상품이 담긴 채 24시간+ 결제하지 않은 유저를 스캔해
 * 발송. 쿨다운 7일로 중복 발송 차단.
 *
 * 심미 가이드
 *   - 히어로 아이콘: 🛒 보단 🐾 가 브랜드 톤에 어울림. 하지만 "장바구니" 메세지는
 *     🛒 가 인지적으로 빠르므로 여기만 예외.
 *   - Callout: gold — "대기/리마인드" 톤. sale(빨강) 은 너무 강해 거부감 큼.
 *   - CTA: "장바구니로 돌아가기" — 결제를 강요하지 않는 부드러운 재진입.
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'

export type CartRecoveryItem = {
  productName: string
  variantName?: string | null
  quantity: number
  lineTotal: number
}

export function renderCartAbandoned(input: {
  recipientName: string
  items: CartRecoveryItem[]
  subtotal: number
}): { subject: string; html: string } {
  const itemCountLabel =
    input.items.length > 1
      ? `${escape(input.items[0]!.productName)} 외 ${input.items.length - 1}개`
      : escape(input.items[0]?.productName ?? '')

  // (광고) 표기 — 정보통신망법 제50조 제4항. 광고성 정보는 제목에 명시 의무.
  // cart-abandoned 메일은 재구매 유도 마케팅이라 (광고) 적용. 거래성(주문확인)
  // 메일과 분리.
  const subject = `(광고) [파머스테일] 장바구니에 ${itemCountLabel} 담아두셨어요 🛒`

  const itemRows = input.items
    .map((it) =>
      block.orderItem(
        it.variantName ? `${it.productName} · ${it.variantName}` : it.productName,
        it.quantity,
        it.lineTotal,
      ),
    )
    .join('')

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 담아두신 상품이 그대로 기다리고 있어요.
    </p>
    ${block.callout(
      'gold',
      '결제까지 완료되지 않아 알려드려요. 인기 상품은 재고가 빠르게 변하니 서둘러 주세요.',
    )}
    <div style="height:14px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${itemRows}
    </table>
    ${block.hr()}
    ${block.dl([
      block.row('상품 합계', `${input.subtotal.toLocaleString()}원`),
    ])}
    <p style="margin:14px 0 0 0;font-size:11px;color:#7A7A7A;line-height:1.6;">
      마음이 바뀌셨다면 장바구니에서 바로 삭제하실 수 있어요. 저희는 더 이상
      이 상품으로 알림을 드리지 않을게요.
    </p>
  `

  const html = renderLayout({
    kicker: 'Cart · 장바구니',
    heading: '아직 담아두신 상품이 있어요',
    icon: '🛒',
    preview: `${itemCountLabel} · ${input.subtotal.toLocaleString()}원 · 결제 대기 중`,
    body,
    cta: {
      label: '장바구니로 돌아가기',
      href: `${SITE_URL}/cart`,
    },
  })

  return { subject, html }
}
