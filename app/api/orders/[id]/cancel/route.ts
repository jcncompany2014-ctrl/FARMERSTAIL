import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  isPaymentStatus,
} from '@/lib/commerce/order-fsm'
import { appendLedger, getCurrentBalance } from '@/lib/commerce/points'
import { cancelPayment } from '@/lib/payments/toss'
import { notifyOrderCancelled } from '@/lib/email'
import { zOrderCancel } from '@/lib/api/schemas'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CancelBody = {
  reason?: string
  reason_category?:
    | 'not_eating'
    | 'digestion_issue'
    | 'weight_change'
    | 'price'
    | 'lifestyle'
    | 'other'
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
      'id, user_id, order_number, payment_status, order_status, payment_key, payment_method, total_amount, points_used, points_earned, recipient_name'
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

  // R84-C1: 가상계좌/계좌이체 self-cancel 은 Toss 가 refundReceiveAccount 필수.
  // 현재 UI 가 환불계좌 입력 폼이 없어서 호출 시 Toss 400. 임시: VA 사용자는
  // self-cancel 차단 + 1:1 문의 안내. 본격적인 환불계좌 입력 UI 는 BACKLOG.
  const isVirtualAccountLike =
    order.payment_method === '가상계좌' ||
    order.payment_method === 'VIRTUAL_ACCOUNT' ||
    order.payment_method === '계좌이체' ||
    order.payment_method === 'TRANSFER'
  if (
    order.payment_status === 'paid' &&
    isVirtualAccountLike &&
    order.payment_key
  ) {
    return NextResponse.json(
      {
        code: 'VA_REFUND_NEEDS_CS',
        message:
          '가상계좌/계좌이체 환불은 환불 계좌 정보가 필요해요. 1:1 문의로 신청해 주시면 영업일 기준 1-3일 안에 환불해 드릴게요.',
      },
      { status: 400 },
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
  // R85-B2: 이전 payment_status 가드 추가 + 0-row 감지로 더블클릭 차단.
  //   두 요청이 동시 도착하면: 둘 다 .is('cancelled_at', null) order_items 읽고
  //   restore_stock 두 번 호출 → 재고 부풀려짐 + refunds 중복 row. 첫 UPDATE
  //   에 .eq('payment_status', order.payment_status) 가드 추가하고 0-row 면 bail.
  const nowIso = new Date().toISOString()
  const refundAmount = order.payment_status === 'paid' ? order.total_amount : 0
  const { data: cancelRows } = await supabase
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
    .eq('payment_status', order.payment_status)
    .select('id')

  if (!cancelRows || cancelRows.length === 0) {
    // 다른 요청 (더블클릭 두 번째 / admin cancel / cron expire) 이 이미 처리.
    return NextResponse.json(
      {
        code: 'ALREADY_PROCESSED',
        message: '이미 처리된 주문이에요.',
      },
      { status: 409 },
    )
  }

  // R60 — 결제 원장 event. 환불은 음수 amount (sum=0 = 완전 환불).
  {
    const { recordPaymentEvent } = await import('@/lib/payment-events')
    await recordPaymentEvent(supabase, {
      orderId: order.id,
      paymentKey: order.payment_key ?? null,
      eventType: refundAmount > 0 ? 'refunded' : 'cancel_requested',
      amount: refundAmount > 0 ? -refundAmount : 0,
      prevStatus: order.payment_status,
      newStatus: 'cancelled',
      source: 'user_cancel',
      actorUserId: user.id,
      metadata: { reason: body.reason || '고객 요청' },
    })
  }

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
    // 점검 fix: refund_order_points RPC 가 orders 행을 FOR UPDATE 잠그고
    // points_refunded 상한으로 잔여분만 원자 환급 — 부분취소(cancel-items) 후
    // 전량취소의 과다환급 + 동시성 과다환급을 차단(read-modify-write 제거).
    // reference=order.id(전량취소는 주문당 1회, 잔여 0이면 RPC 가 no-op).
    // service_role 전용 RPC 라 admin 클라이언트로 호출.
    // refund_order_points 는 신규 RPC 라 generated types 에 없음 → cast.
    const { error: refundPointsErr } = await (
      admin as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message?: string } | null }>
      }
    ).rpc('refund_order_points', {
      p_order_id: order.id,
      p_user_id: user.id,
      p_request: order.points_used,
      p_reason: '주문 취소 포인트 환급',
      p_reference_id: order.id,
    })
    if (refundPointsErr) {
      console.error(
        `[cancel] refund_order_points failed: order=${order.id} ${refundPointsErr.message}`,
      )
    }
  }
  // 4) Revoke earned points (only if they were actually credited — paid orders).
  //    음수 delta를 직접 넣어야 하므로 creditPoints/debitPoints 대신 appendLedger.
  if (order.points_earned > 0 && order.payment_status !== 'pending') {
    const revoke = await appendLedger(supabase, {
      userId: user.id,
      delta: -order.points_earned,
      reason: '주문 취소 적립 회수',
      referenceType: 'order_refund_revoke',
      referenceId: order.id,
    })
    // R100-B: 회수 결과 검사 + 부분 회수 fallback. 이전엔 결과를 무시해서,
    // 사용자가 적립 포인트를 이미 다른 주문에 써서 잔액 < points_earned 면
    // apply_point_delta 가 v_next<0 으로 거부(ok=false)한 걸 흘려보내 적립금이
    // 순증했다 ("적립 → 그 포인트로 결제 → 원주문 취소"). RPC 는 거부 시 row
    // INSERT 를 하지 않으므로(같은 reference 재시도 가능) 현재 잔액만큼 부분
    // 회수하고, 그래도 남는 부족분은 error 로깅해 운영자가 인지/수동 정산한다.
    if (!revoke.ok) {
      const balance = await getCurrentBalance(supabase, user.id)
      const partial = Math.min(order.points_earned, Math.max(0, balance))
      if (partial > 0) {
        await appendLedger(supabase, {
          userId: user.id,
          delta: -partial,
          reason: '주문 취소 적립 부분 회수(잔액 한도)',
          referenceType: 'order_refund_revoke',
          referenceId: order.id,
        })
      }
      const shortfall = order.points_earned - partial
      if (shortfall > 0) {
        console.error(
          `[cancel] earned-point clawback shortfall: order=${order.id} user=${user.id} earned=${order.points_earned} revoked=${partial} shortfall=${shortfall}`,
        )
      }
    }
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

  // R84-C3: 취소 push 알림 추가. 이전엔 메일만 — 사용자가 push 만 켠 경우
  // 환불 처리 사실 모름. 카드 3-5영업일 / VA 1-3영업일 안내.
  try {
    const { pushToUser } = await import('@/lib/push')
    const refundDays =
      order.payment_method === '가상계좌' || order.payment_method === 'VIRTUAL_ACCOUNT'
        ? '1-3영업일'
        : '3-5영업일'
    await pushToUser(
      order.user_id,
      {
        title: '주문이 취소됐어요',
        body:
          order.payment_status === 'paid'
            ? `환불은 ${refundDays} 안에 진행돼요.`
            : '주문이 취소 처리됐어요.',
        url: `/mypage/orders/${order.id}`,
        tag: `order-cancel-${order.id}`,
      },
      { category: 'order' },
    )
  } catch {
    /* push 실패 — 메일이 이미 발송됨 */
  }

  // Phase 3 (2026-05-20): outcome 자동 기록 — 환불 사유 분류 누적.
  // palatability(not_eating) / digestibility(digestion_issue) / outcome(weight_change)
  // 신호가 admin cohort 대시보드의 핵심 데이터.
  if (body.reason_category) {
    try {
      const { recordOutcome } = await import('@/lib/feeding-outcomes')
      const { data: dogRow } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (dogRow) {
        await recordOutcome(supabase, {
          dog_id: dogRow.id,
          user_id: user.id,
          source: 'refund',
          reason_category: body.reason_category,
          comment: body.reason ?? null,
          order_id: order.id,
        })
      }
    } catch {
      /* best-effort — outcome 기록 실패가 환불을 막지 않도록 */
    }
  }

  return NextResponse.json({ ok: true })
}
