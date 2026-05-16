import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'

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
  tagSentryRoute('order.cancel')
  await tagSentryUser(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
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
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없어요' },
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
            '결제 취소에 실패했어요. 잠시 후 다시 시도해 주세요',
        },
        { status: 400 }
      )
    }
  }

  // 2) Flip order row + 부분취소 audit/stock 복원과 동일한 토대로 통일.
  const nowIso = new Date().toISOString()
  const refundAmount = order.payment_status === 'paid' ? order.total_amount : 0
  await supabase
    .from('orders')
    .update({
      payment_status: 'cancelled',
      order_status: 'cancelled',
      cancelled_at: nowIso,
      cancel_reason: body.reason || '고객 요청',
      refunded_amount: refundAmount,
    })
    .eq('id', order.id)
    .eq('user_id', user.id)

  // 2b) 항목 단위 cancelled_at 마킹 + stock 복원 + refunds audit row.
  // RLS 우회 필요 작업 (stock RPC + refunds insert) 은 admin client.
  // 본인 주문 검증은 위에서 이미 완료.
  const admin = createAdminClient()
  const { data: items } = await admin
    .from('order_items')
    .select('id, product_id, quantity, line_total')
    .eq('order_id', order.id)
    .is('cancelled_at', null)
  const itemsArr = (items ?? []) as Array<{
    id: string
    product_id: string
    quantity: number
    line_total: number
  }>
  if (itemsArr.length > 0) {
    await admin
      .from('order_items')
      .update({ cancelled_at: nowIso })
      .in(
        'id',
        itemsArr.map((it) => it.id),
      )
    // refunded_amount = line_total 일괄 업데이트
    for (const it of itemsArr) {
      await admin
        .from('order_items')
        .update({ refunded_amount: it.line_total })
        .eq('id', it.id)
      // stock 복원
      await admin.rpc('restore_stock', {
        p_product_id: it.product_id,
        p_qty: it.quantity,
      })
    }
  }
  // 환불 audit row — paid 상태였던 주문만 (pending 취소는 환불 0).
  if (refundAmount > 0) {
    await admin.from('refunds').insert({
      order_id: order.id,
      user_id: user.id,
      amount: refundAmount,
      reason: body.reason ?? null,
      refunded_by: null, // self-service
      status: 'succeeded',
      order_item_ids: null, // 전체 취소
      is_partial: false,
    })
  }

  // 3) Refund used points — appendLedger 헬퍼로 일원화.
  // audit #64: 환급/회수가 같은 reference_id 로 두 row 시도 → uq_point_ledger_reference
  // 가 두 번째를 차단 → RPC 가 silent ok=true (already_applied) 로 반환 → 둘 중 하나만
  // 적용되는 무한 적립 버그. referenceType 을 분리해 unique 충돌 회피.
  if (order.points_used > 0) {
    await creditPoints(supabase, {
      userId: user.id,
      amount: order.points_used,
      reason: '주문 취소 포인트 환급',
      referenceType: 'order_refund_credit',
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
      referenceType: 'order_refund_revoke',
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
