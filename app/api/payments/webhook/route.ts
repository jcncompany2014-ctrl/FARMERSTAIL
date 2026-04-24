import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { creditPoints } from '@/lib/commerce/points'
import { fetchPayment, type TossPaymentStatus } from '@/lib/payments/toss'
import { notifyOrderCancelled, notifyOrderPlaced } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Toss Payments webhook receiver.
 *
 * Why this exists (even though /api/payments/confirm already records paid orders):
 *   • Virtual account (가상계좌) customers complete the flow LATER —
 *     sometimes days after closing the browser. The confirm call only
 *     gives us a "WAITING_FOR_DEPOSIT" response. The actual deposit
 *     arrives as a webhook.
 *   • Users who close the tab mid-card-flow don't trigger confirm.
 *     Toss still sends the webhook so we can finalize state.
 *   • Refunds initiated via Toss dashboard (manual ops) only surface
 *     through the webhook.
 *
 * Security model:
 *   Toss does NOT sign webhooks with HMAC. The official recommendation
 *   is to re-fetch the payment from Toss using the paymentKey — that
 *   read requires the Secret Key, so an attacker forging a webhook
 *   body can't lie about the payment state. We trust the re-fetched
 *   status, not the webhook body.
 *
 * Idempotency:
 *   Toss retries on non-2xx. Handler reads current order state and
 *   short-circuits if already in the target status.
 *
 * Env:
 *   TOSS_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

type WebhookBody = {
  eventType?: string
  createdAt?: string
  data?: {
    paymentKey?: string
    orderId?: string
    status?: TossPaymentStatus
  }
}

export async function POST(req: Request) {
  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    // Bad JSON — tell Toss to stop retrying. No business data lost
    // because confirm is still the happy-path source of truth.
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 200 })
  }

  const paymentKey = body?.data?.paymentKey
  const orderId = body?.data?.orderId // this is our order_number

  if (!paymentKey || !orderId) {
    return NextResponse.json(
      { ok: false, reason: 'missing_fields' },
      { status: 200 }
    )
  }

  // 1) Re-fetch payment from Toss — this is our truth source.
  //    lib/payments/toss 가 auth 헤더와 base URL을 책임.
  const lookup = await fetchPayment(paymentKey)
  if (!lookup.ok) {
    // Toss API itself returned an error — don't trust the webhook.
    // Return 500 so Toss retries; if it's a permanent 4xx the retry
    // budget will bleed out but at least we don't corrupt state.
    return NextResponse.json(
      { ok: false, reason: 'toss_lookup_failed', tossError: lookup.error },
      { status: 500 }
    )
  }
  const payment = lookup.data

  // Sanity: the paymentKey we looked up must match the event's paymentKey.
  if (payment.paymentKey !== paymentKey) {
    return NextResponse.json(
      { ok: false, reason: 'paymentkey_mismatch' },
      { status: 200 }
    )
  }

  // 2) Find our order row using order_number (what we sent to Toss as orderId).
  const supabase = createAdminClient()
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, total_amount, payment_status, order_status, points_earned, paid_at, shipping_fee, recipient_name'
    )
    .eq('order_number', orderId)
    .maybeSingle()

  if (orderErr || !order) {
    // Not our order. Acknowledge with 200 so Toss stops retrying —
    // a retry won't ever succeed.
    return NextResponse.json(
      { ok: false, reason: 'order_not_found' },
      { status: 200 }
    )
  }

  // 3) Amount check — if it doesn't match we have a serious problem.
  // Still ack with 200 (retries won't help), but log for ops.
  if (payment.totalAmount !== order.total_amount) {
    console.error(
      `[webhook] amount mismatch order=${orderId} expected=${order.total_amount} got=${payment.totalAmount}`
    )
    return NextResponse.json(
      { ok: false, reason: 'amount_mismatch' },
      { status: 200 }
    )
  }

  // 4) Apply state transition based on Toss status.
  switch (payment.status) {
    case 'DONE': {
      // Already final → idempotent skip.
      if (order.payment_status === 'paid') {
        return NextResponse.json({ ok: true, skipped: 'already_paid' })
      }

      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: payment.method ?? null,
          payment_key: paymentKey,
          paid_at: payment.approvedAt ?? new Date().toISOString(),
          // Only promote to "preparing" if we haven't already moved forward.
          order_status:
            order.order_status === 'pending' ? 'preparing' : order.order_status,
          // 가상계좌 입금 완료 시점에야 비로소 Toss가 최종 영수증을
          // 발급하므로 여기서도 업데이트 (카드는 confirm에서 이미 세팅).
          receipt_url: payment.receipt?.url ?? null,
        })
        .eq('id', order.id)

      // Award points if the order has earn amount and we haven't credited yet.
      // 멱등성 체크: 같은 주문의 같은 delta 적립 row가 있으면 스킵 —
      // Toss가 중복 웹훅을 보낼 수 있어서 (동일 eventId, 재시도 등).
      if (order.points_earned && order.points_earned > 0) {
        const { data: already } = await supabase
          .from('point_ledger')
          .select('id')
          .eq('reference_type', 'order')
          .eq('reference_id', order.id)
          .eq('delta', order.points_earned)
          .maybeSingle()
        if (!already) {
          await creditPoints(supabase, {
            userId: order.user_id,
            amount: order.points_earned,
            reason: '주문 결제 적립 (웹훅)',
            referenceType: 'order',
            referenceId: order.id,
          })
        }
      }

      // Notify the customer — virtual-account deposits are the key case.
      pushToUser(
        order.user_id,
        {
          title: '입금이 확인됐어요 🐾',
          body: `${payment.totalAmount.toLocaleString()}원 결제가 완료됐어요. 상품을 준비할게요.`,
          url: `/mypage/orders/${order.id}`,
          tag: `order-${order.id}`,
        },
        { category: 'order' },
      ).catch(() => {
        /* best-effort */
      })

      // 이메일 주문 접수 안내 — 가상계좌 입금 완료 시 최초 "정식 접수" 메일.
      // confirm 단계에서 DONE이 아닌 WAITING_FOR_DEPOSIT으로 빠진 주문은
      // 여기서 비로소 주문 접수 메일을 받는다.
      notifyOrderPlaced(supabase, {
        orderId: order.id,
        userId: order.user_id,
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? null,
        totalAmount: order.total_amount,
        shippingFee: order.shipping_fee ?? 0,
        paymentMethod: payment.method ?? null,
      }).catch(() => {})
      break
    }

    case 'WAITING_FOR_DEPOSIT': {
      // Virtual account issued but not yet deposited. confirm route 가 이미
      // VA 필드를 세팅했을 가능성이 높지만, 유저가 confirm을 거치지 않은
      // 엣지 케이스(탭 닫음)를 대비해 여기서도 업데이트 한 번 더.
      const va = payment.virtualAccount
      if (va) {
        await supabase
          .from('orders')
          .update({
            payment_method: payment.method ?? null,
            payment_key: paymentKey,
            virtual_account_bank: va.bankCode ?? null,
            virtual_account_number: va.accountNumber ?? null,
            virtual_account_due_date: va.dueDate ?? null,
            virtual_account_holder: va.customerName ?? null,
          })
          .eq('id', order.id)
      }
      break
    }

    case 'CANCELED':
    case 'PARTIAL_CANCELED': {
      // PARTIAL_CANCELED = 일부 환불이 일어났지만 나머지는 유효한 상태.
      // 이 플로우에서는 "전액 환불"만 지원하므로 PARTIAL을 'partially_refunded'
      // 라벨로 기록만 해두고 order_status 는 유지 (관리자가 수동 처리).
      if (order.payment_status === 'cancelled') {
        return NextResponse.json({ ok: true, skipped: 'already_cancelled' })
      }
      const isPartial = payment.status === 'PARTIAL_CANCELED'
      await supabase
        .from('orders')
        .update({
          payment_status: isPartial ? 'partially_refunded' : 'cancelled',
          order_status: isPartial ? order.order_status : 'cancelled',
          cancelled_at: isPartial ? null : new Date().toISOString(),
          cancel_reason: isPartial ? null : '결제 취소 (토스)',
        })
        .eq('id', order.id)

      // 전액 취소일 때만 고객 메일을 보냄 — 부분 환불은 ops 가 별도 커뮤니케이션.
      if (!isPartial) {
        notifyOrderCancelled(supabase, {
          orderId: order.id,
          userId: order.user_id,
          orderNumber: order.order_number,
          recipientName: order.recipient_name ?? null,
          totalAmount: order.total_amount,
          reason: '결제 취소 (토스)',
          refundAmount: order.total_amount,
        }).catch(() => {})
      }
      break
    }

    case 'ABORTED':
    case 'EXPIRED': {
      if (order.payment_status === 'failed') {
        return NextResponse.json({ ok: true, skipped: 'already_failed' })
      }
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
      break
    }

    default:
      // READY / IN_PROGRESS — transitional states, nothing to persist.
      break
  }

  return NextResponse.json({ ok: true })
}
