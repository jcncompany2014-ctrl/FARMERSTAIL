import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  isPaymentStatus,
} from '@/lib/commerce/order-fsm'
import { creditPoints, appendLedger } from '@/lib/commerce/points'
import { revokeCouponRedemption } from '@/lib/coupons'

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

  let body: CancelBody = {}
  try {
    body = await req.json()
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
      'id, user_id, payment_status, order_status, payment_key, total_amount, points_used, points_earned, coupon_code'
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

  // 1) Call Toss cancel if already paid
  if (order.payment_status === 'paid' && order.payment_key) {
    const secretKey = process.env.TOSS_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { code: 'SERVER_CONFIG', message: '서버 설정 오류' },
        { status: 500 }
      )
    }
    const encryptedSecret = Buffer.from(`${secretKey}:`).toString('base64')
    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${order.payment_key}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encryptedSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: body.reason || '고객 요청',
        }),
        cache: 'no-store',
      }
    )
    if (!tossRes.ok) {
      const tossData = await tossRes.json().catch(() => ({}))
      return NextResponse.json(
        {
          code: tossData?.code ?? 'TOSS_CANCEL_FAILED',
          message:
            tossData?.message ??
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

  return NextResponse.json({ ok: true })
}
