import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  if (['shipping', 'delivered', 'cancelled'].includes(order.order_status)) {
    return NextResponse.json(
      {
        code: 'NOT_CANCELLABLE',
        message: '이미 배송이 시작되었거나 취소된 주문이에요',
      },
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

  // Helper: append ledger entry computing balance_after from latest
  async function appendLedger(
    delta: number,
    reason: string,
    refType = 'order'
  ) {
    const { data: last } = await supabase
      .from('point_ledger')
      .select('balance_after')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const prev = last?.balance_after ?? 0
    await supabase.from('point_ledger').insert({
      user_id: user!.id,
      delta,
      balance_after: prev + delta,
      reason,
      reference_type: refType,
      reference_id: order!.id,
    })
  }

  // 3) Refund used points
  if (order.points_used > 0) {
    await appendLedger(order.points_used, '주문 취소 포인트 환급')
  }
  // 4) Revoke earned points (only if they were actually credited — paid orders)
  if (order.points_earned > 0 && order.payment_status !== 'pending') {
    await appendLedger(-order.points_earned, '주문 취소 적립 회수')
  }

  // 5) Decrement coupon usage
  if (order.coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, used_count')
      .eq('code', order.coupon_code)
      .maybeSingle()
    if (coupon) {
      await supabase
        .from('coupons')
        .update({ used_count: Math.max(0, coupon.used_count - 1) })
        .eq('id', coupon.id)
    }
  }

  return NextResponse.json({ ok: true })
}
