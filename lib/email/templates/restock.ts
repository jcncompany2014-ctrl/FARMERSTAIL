/**
 * Farmer's Tail — 재입고 알림 메일 템플릿.
 *
 * 트리거: admin 이 품절 상품의 stock 을 0 → N 으로 올렸을 때, cron 또는
 * 전용 dispatch 엔드포인트가 restock_alerts 의 미통지 구독자들에게 일괄 발송.
 *
 * 심미 가이드
 *   - 히어로 아이콘: 🐾 가 가장 "기다렸던 소식" 톤에 어울림.
 *   - CTA 라벨: "지금 주문하기" — 만료 절박함(gold)까지는 아니고 terracotta 톤.
 *   - 상품 이미지는 메일에서 일부 클라이언트(특히 기업 메일)가 차단하므로,
 *     이미지 없이도 본문 가독성이 유지되게 제목을 크게.
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'

export function renderRestockAlert(input: {
  recipientName: string
  productName: string
  productSlug: string
  variantName?: string | null
  price: number
  imageUrl?: string | null
}): { subject: string; html: string } {
  const subject = `[파머스테일] 기다리시던 ${input.productName}가 돌아왔어요 🐾`
  const heroImage = input.imageUrl
    ? `<img src="${escape(input.imageUrl)}" alt="${escape(input.productName)}" width="200" style="display:block;margin:0 auto 16px;border-radius:12px;max-width:200px;height:auto;" />`
    : ''

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 기다리시던 소식이에요.
    </p>
    ${heroImage}
    <div style="text-align:center;margin:8px 0;">
      <div style="font-size:16px;font-weight:800;color:#1E1A14;margin-bottom:6px;letter-spacing:-0.01em;">
        ${escape(input.productName)}
      </div>
      ${input.variantName
        ? `<div style="font-size:11px;color:#7A7A7A;margin-bottom:6px;">옵션 · ${escape(input.variantName)}</div>`
        : ''}
      <div style="font-size:20px;font-weight:800;color:#B5533A;font-family:'Archivo Black',sans-serif;letter-spacing:-0.01em;">
        ${input.price.toLocaleString()}원
      </div>
    </div>
    ${block.callout(
      'moss',
      `재입고되었어요. 재고가 한정적이에요 — 보통 하루이틀 안에 다시 품절되니
      지금 주문하시는 게 좋아요.`,
    )}
  `
  const html = renderLayout({
    kicker: 'Back in Stock · 재입고',
    heading: '다시 돌아왔어요',
    icon: '🐾',
    preview: `${input.productName} 재입고 알림`,
    body,
    cta: {
      label: '지금 주문하기',
      href: `${SITE_URL}/products/${input.productSlug}`,
    },
  })
  return { subject, html }
}
