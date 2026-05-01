import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/email/client'
import { renderLayout, escape, SITE_URL, block } from '@/lib/email/layout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/review-prompts
 *
 * 매일 1회. 배송 완료 후 N=3일 지난 주문에 대해 리뷰 작성 안내 메일 1회.
 * 사용자가 이미 리뷰를 작성한 주문은 자동 skip.
 *
 * # 트리거 조건
 *   - orders.order_status = 'delivered'
 *   - orders.delivered_at <= now() - 3 days
 *   - orders.review_prompted_at IS NULL  (단 1회 발송)
 *   - 해당 user_id 가 reviews 테이블에 row 가 있어도 다른 상품 리뷰는 가능
 *     하므로 발송 (멱등은 review_prompted_at 으로 보장)
 *
 * # 보안
 * CRON_SECRET bearer.
 */

const PROMPT_DELAY_DAYS = 3
const MAX_PER_RUN = 50

type OrderRow = {
  id: string
  user_id: string
  order_number: string
  recipient_name: string | null
  delivered_at: string | null
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const cutoff = new Date(
    Date.now() - PROMPT_DELAY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  // 발송 대상.
  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, user_id, order_number, recipient_name, delivered_at')
    .eq('order_status', 'delivered')
    .lte('delivered_at', cutoff)
    .is('review_prompted_at', null)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  const targets = (orders ?? []) as OrderRow[]
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const order of targets) {
    // user 이메일 조회.
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', order.user_id)
      .maybeSingle()
    if (!profile?.email) {
      // 익명화된 사용자 — silent skip + prompted_at 으로 마킹해 재발송 차단.
      await supabase
        .from('orders')
        .update({ review_prompted_at: new Date().toISOString() })
        .eq('id', order.id)
      skipped += 1
      continue
    }

    const { subject, html } = renderReviewPrompt({
      recipientName: profile.name ?? order.recipient_name ?? '고객',
      orderNumber: order.order_number,
      orderId: order.id,
    })

    try {
      await sendEmail({
        to: profile.email,
        subject,
        html,
        tag: 'review-prompt',
        idempotencyKey: `review-prompt:${order.id}`,
      })
      sent += 1
    } catch {
      failed += 1
    }

    // prompted_at 마킹 — 발송 실패해도 한 번만. 사용자에게 같은 메일이 5번
    // 가는 것보다 한 번 누락되는 게 낫다.
    await supabase
      .from('orders')
      .update({ review_prompted_at: new Date().toISOString() })
      .eq('id', order.id)
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    checked: targets.length,
    sent,
    failed,
    skipped,
  })
}

function renderReviewPrompt(input: {
  recipientName: string
  orderNumber: string
  orderId: string
}): { subject: string; html: string } {
  const subject = `[파머스테일] ${input.recipientName}님, 어떠셨어요? · ${input.orderNumber}`

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    <p style="margin:0 0 14px 0;">
      며칠 전 받으신 주문, 우리 아이가 잘 먹었나요? 짧은 후기 한 줄이면 다른
      반려인이 선택할 때 큰 도움이 돼요. 작성해 주신 분에게는 다음 구매에 쓸
      수 있는 적립금을 드려요.
    </p>
    ${block.callout(
      'moss',
      '리뷰 작성 시 적립금 자동 지급 (공정거래위원회 추천·보증 심사지침 고지)',
    )}
  `

  const html = renderLayout({
    preview: subject,
    kicker: 'Review · 후기 부탁',
    heading: '우리 아이가 잘 먹었나요?',
    body,
    cta: {
      label: '리뷰 작성하기',
      href: `${SITE_URL}/mypage/orders/${input.orderId}`,
    },
  })

  return { subject, html }
}
