import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  isPaymentStatus,
} from '@/lib/commerce/order-fsm'
import { creditPoints, appendLedger } from '@/lib/commerce/points'
import { revokeCouponRedemption } from '@/lib/coupons'
import { cancelPayment } from '@/lib/payments/toss'
import { notifyOrderCancelled } from '@/lib/email'
import { zOrderCancel } from '@/lib/api/schemas'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CancelBody = {
  reason?: string
}

/**
 * POST /api/orders/[id]/cancel
 *
 * Self-service cancellation.
 * Allowed only while order_status is 'pending' or 'preparing' (not yet shipped).
 *
 * On cancel:
 *   1. If payment_status='paid' and payment_key exists → call Toss payments/{paymentKey}/cancel
 *   2. Flip orders row: payment_status='cancelled', order_status='cancelled', cancelled_at/reason set
 *   3. Refund points_used back to the ledger
 *   4. Revoke points_earned from the ledger
 *   5. Decrement coupons.used_count (redemption row is kept for audit)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Rate limit — 자기 주문이라도 폭주 시 Toss/이메일/포인트 RPC 까지 호출되니
  // 보호. 정상 사용자는 분당 1-2회 정도면 충분.
  const rl = rateLimit({
    bucket: 'order-cancel',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  let body: CancelBody = {}
  try {
    const raw = await req.json()
    const parsed = zOrderCancel.safeParse(raw)
    if (parsed.success) body = parsed.data
    // 빈 body 허용 — reason 자체가 optional. parse 실패해도 reason 만 무시.
  } catch {
    /* allow empty body */
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, payment_status, order_status, payment_key, total_amount, points_used, points_earned, coupon_code, recipient_name'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // FSM에 고객 취소 전환 가능 여부를 위임. 규칙: pending/preparing 에서만 허용.
  if (!isOrderStatus(order.order_status) || !isPaymentStatus(order.payment_status)) {
    return NextResponse.json(
      { code: 'INVALID_DB_STATE', message: '주문 상태가 손상돼 있어요' },
      { status: 500 }
    )
  }
  const transition = canTransitionOrderStatus(order.order_status, 'cancelled', {
    payment_status: order.payment_status,
    actor: 'customer',
  })
  if (!transition.ok) {
    return NextResponse.json(
      { code: 'NOT_CANCELLABLE', message: transition.reason },
      { status: 400 }
    )
  }

  // 1) Call Toss cancel if already paid — lib/payments/toss 가 idempotency 처리.
  if (order.payment_status === 'paid' && order.payment_key) {
    const cancelResult = await cancelPayment({
      paymentKey: order.payment_key,
      cancelReason: body.reason || '고객 요청',
    })
    if (!cancelResult.ok) {
      return NextResponse.json(
        {
          code: cancelResult.error.code || 'TOSS_CANCEL_FAILED',
          message:
            cancelResult.error.message ||
            '결제 취소에 실패했어요. 잠시 후 다시 시도해주세요',
        },
        { status: 400 }
      )
    }
  }

  // 2) Flip order row
  const nowIso = new Date().toISOString()
  await supabase
    .from('orders')
    .update({
      payment_status: 'cancelled',
      order_status: 'cancelled',
      cancelled_at: nowIso,
      cancel_reason: body.reason || '고객 요청',
    })
    .eq('id', order.id)
    .eq('user_id', user.id)

  // 3) Refund used points — appendLedger 헬퍼로 일원화.
  if (order.points_used > 0) {
    await creditPoints(supabase, {
      userId: user.id,
      amount: order.points_used,
      reason: '주문 취소 포인트 환급',
      referenceType: 'order_refund',
      referenceId: order.id,
    })
  }
  // 4) Revoke earned points (only if they were actually credited — paid orders).
  //    음수 delta를 직접 넣어야 하므로 creditPoints/debitPoints 대신 appendLedger.
  if (order.points_earned > 0 && order.payment_status !== 'pending') {
    await appendLedger(supabase, {
      userId: user.id,
      delta: -order.points_earned,
      reason: '주문 취소 적립 회수',
      referenceType: 'order_refund',
      referenceId: order.id,
    })
  }

  // 5) Decrement coupon usage — redemption 행은 감사 목적으로 보존.
  if (order.coupon_code) {
    await revokeCouponRedemption(supabase, { couponCode: order.coupon_code })
  }

  // 6) 이메일 안내 — fire-and-forget. 취소 플로우가 메일 때문에 늦어지지 않도록.
  notifyOrderCancelled(supabase, {
    orderId: order.id,
    userId: user.id,
    orderNumber: order.order_number,
    recipientName: order.recipient_name ?? null,
    totalAmount: order.total_amount,
    reason: body.reason ?? null,
    refundAmount: order.payment_status === 'paid' ? order.total_amount : null,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
