import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelPayment } from '@/lib/payments/toss'
import { notifyOrderCancelled } from '@/lib/email'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { parseRequest } from '@/lib/api/parseRequest'
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'
import { appendLedger, computePointsRefund } from '@/lib/commerce/points'
import { revokeCouponRedemption } from '@/lib/coupons'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/[id]/cancel-items
 *
 * 부분 취소 (item-level cancel).
 *
 * # 요청
 * { itemIds: string[]; reason?: string }
 *
 * # 처리 흐름
 *   1) 본인 주문 + cancellable 상태 확인 (pending/preparing 만)
 *   2) itemIds 가 모두 이 주문에 속하는지 + 아직 미취소 상태인지 확인
 *   3) 환불 금액 계산 = sum(line_total of those items). 배송비는 영향 없음
 *      (남은 항목이 있으면 — 모든 항목을 취소하면 전체 cancel 경로로 안내).
 *   4) Toss partial cancel 호출 (cancelAmount 명시)
 *   5) order_items.cancelled_at + refunded_amount 갱신
 *   6) products.stock 복원 (restore_stock RPC)
 *   7) orders.refunded_amount += cancelAmount
 *   8) refunds row insert (audit)
 *   9) 만약 모든 item 이 cancelled 가 됐다면 orders.order_status='cancelled' 로 전환
 *  10) 이메일 안내 (부분 환불)
 *
 * # 보안
 * - rate limit (분당 5)
 * - RLS: 본인 주문만 select 가능. order_items 도 RLS join 으로 user_id 매칭.
 * - service_role 은 stock 복원 + refunds insert 에만 사용 (RLS 우회 필요한 작업).
 *
 * # 멱등
 * 같은 itemIds set 으로 두 번 호출되면 두 번째는 "이미 취소됨" 400. Toss
 * idempotencyKey 는 cancelAmount 포함이라 같은 amount 두 번이면 자동 dedupe.
 */
const zCancelItems = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '취소할 상품을 선택해 주세요').max(50),
  reason: z.string().max(200).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const rl = rateLimit({
    bucket: 'order-cancel-items',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zCancelItems)
  if (!parsed.ok) return parsed.response
  const { itemIds, reason } = parsed.data

  const supabase = await createClient()
  tagSentryRoute('order.cancel.items')
  await tagSentryUser(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // 1) 주문 + 항목 fetch (본인 only)
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, payment_status, order_status, payment_key, total_amount, refunded_amount, recipient_name, points_used, coupon_code',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 부분 취소 가능: pending / preparing 만. shipped 이상은 admin 영역.
  if (!['pending', 'preparing'].includes(order.order_status)) {
    return NextResponse.json(
      {
        code: 'NOT_CANCELLABLE',
        message: '발송 시작 후에는 취소할 수 없어요',
      },
      { status: 400 },
    )
  }

  // 2) 항목 fetch — order_id + 미취소 + itemIds 일치.
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, quantity, unit_price, line_total, cancelled_at, product_name')
    .eq('order_id', order.id)
    .in('id', itemIds)
    .is('cancelled_at', null)

  const itemsArr = (items ?? []) as Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    line_total: number
    cancelled_at: string | null
    product_name: string
  }>

  if (itemsArr.length === 0) {
    return NextResponse.json(
      {
        code: 'NO_CANCELLABLE_ITEMS',
        message: '취소할 수 있는 상품이 없어요',
      },
      { status: 400 },
    )
  }

  // 모든 itemIds 가 fetch 결과에 포함되어야 함 (이미 취소된 것 섞이면 reject).
  const fetchedIds = new Set(itemsArr.map((i) => i.id))
  for (const want of itemIds) {
    if (!fetchedIds.has(want)) {
      return NextResponse.json(
        {
          code: 'ITEM_NOT_AVAILABLE',
          message: '이미 취소된 상품이 포함돼 있어요',
        },
        { status: 400 },
      )
    }
  }

  const cancelAmount = itemsArr.reduce((s, it) => s + it.line_total, 0)
  if (cancelAmount <= 0) {
    return NextResponse.json(
      { code: 'INVALID_AMOUNT', message: '환불 금액이 0 이하예요' },
      { status: 400 },
    )
  }

  // 3) 잔여 항목 — 모두 취소면 전체 취소 경로로 redirect 권유
  const { count: totalActiveItemCount } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .is('cancelled_at', null)
  const willBecomeFullyCancelled =
    (totalActiveItemCount ?? 0) === itemsArr.length

  // 4) Toss partial (또는 잔여 모두 → full) cancel 호출.
  let tossTransactionKey: string | null = null
  if (order.payment_status === 'paid' && order.payment_key) {
    const cancelResult = await cancelPayment({
      paymentKey: order.payment_key,
      cancelReason: reason || '고객 부분 취소',
      // willBecomeFullyCancelled 면 Toss 에 amount 안 보내 잔여 전체 환불.
      cancelAmount: willBecomeFullyCancelled ? undefined : cancelAmount,
    })
    if (!cancelResult.ok) {
      return NextResponse.json(
        {
          code: cancelResult.error.code || 'TOSS_CANCEL_FAILED',
          message:
            cancelResult.error.message ||
            '결제 취소에 실패했어요. 잠시 후 다시 시도해 주세요',
        },
        { status: 400 },
      )
    }
    // 응답에서 마지막 cancel 의 transactionKey 추출 (response.cancels 배열 마지막 element).
    type CancelsEntry = { transactionKey?: string }
    const cancels = (cancelResult.data as { cancels?: CancelsEntry[] }).cancels ?? []
    tossTransactionKey = cancels[cancels.length - 1]?.transactionKey ?? null
  }

  // 5-8) DB 상태 갱신은 admin 클라이언트로 일괄. RLS 우회 필요한 stock RPC +
  //      refunds insert 포함. 본인 user_id 검증은 위에서 이미 완료했으므로
  //      안전 (admin 권한 남용 위험 X).
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // R100-1 (Critical): order_items 원자적 선점. `.is('cancelled_at', null)`
  //   가드 + `.select()` 로 "내가 실제로 취소시킨 행" 만 회수해서 동시 더블클릭의
  //   두 번째 요청을 0-row 로 차단한다. 검증된 전체취소(cancel/route.ts:172) 패턴을
  //   item 단위로 적용. 이전엔 무조건 UPDATE 라 동시 2요청이 둘 다 통과 →
  //   restore_stock 2회(재고 부풀림) + refunds row 2개 + sales_count/
  //   cumulative_spend 트리거 중복 차감. Toss 는 idempotencyKey(amount 포함)로
  //   자체 dedupe 되지만 DB 부수효과는 멱등이 아니므로 이 선점이 진실의 원천이다.
  //   이후 모든 DB 처리는 claimedItems(선점 성공분) 기준.
  const { data: claimedRows } = await admin
    .from('order_items')
    .update({ cancelled_at: nowIso })
    .in('id', itemIds)
    .is('cancelled_at', null)
    .select('id, product_id, quantity, line_total, product_name')

  const claimedItems = (claimedRows ?? []) as Array<{
    id: string
    product_id: string
    quantity: number
    line_total: number
    product_name: string
  }>
  if (claimedItems.length === 0) {
    // 동시 더블클릭 / cron expire / admin cancel 이 이미 이 항목들을 취소함.
    return NextResponse.json(
      { code: 'ALREADY_PROCESSED', message: '이미 처리된 주문이에요.' },
      { status: 409 },
    )
  }
  const claimedIds = claimedItems.map((i) => i.id)
  const claimedCancelAmount = claimedItems.reduce((s, it) => s + it.line_total, 0)

  // 선점한 항목의 refunded_amount = line_total 로 기록.
  for (const it of claimedItems) {
    await admin
      .from('order_items')
      .update({ refunded_amount: it.line_total })
      .eq('id', it.id)
  }

  // products.stock 복원 — RPC. 선점 성공분만.
  for (const it of claimedItems) {
    await admin.rpc('restore_stock', {
      p_product_id: it.product_id,
      p_qty: it.quantity,
    })
  }

  // 선점 후 남은 미취소 항목 수로 전량취소 여부 확정. 선점 전 추정값
  // (willBecomeFullyCancelled, Toss amount 결정용) 과 흔한 케이스엔 동일하나,
  // 부분 겹침 동시요청 대비 선점 후 재확인이 정확하다.
  const { count: remainingActive } = await admin
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .is('cancelled_at', null)
  const fullyCancelled = (remainingActive ?? 0) === 0

  // orders.refunded_amount 누적. (선점 성공분 claimedCancelAmount 기준)
  const newRefundedAmount = (order.refunded_amount ?? 0) + claimedCancelAmount

  // (a) refunds 감사 row 를 먼저 insert 하고 그 id 를 포인트 환급 ledger 의
  //     reference 로 쓴다. 점검 blocker: order.id 단독 reference 는 순차 부분취소·
  //     전량취소와 uq_point_ledger_reference(user,type,ref) 충돌 → 2회차 이후 환급이
  //     silent 차단(already_applied)돼 고객이 포인트를 잃었다. refunds.id 는 취소
  //     이벤트마다 유일하므로 충돌 없이 매번 환급된다.
  const { data: refundRow } = await admin
    .from('refunds')
    .insert({
      order_id: order.id,
      user_id: user.id,
      amount: claimedCancelAmount,
      reason: reason ?? null,
      toss_transaction_key: tossTransactionKey,
      refunded_by: null, // self-service
      status: 'succeeded',
      order_item_ids: claimedIds,
      is_partial: !fullyCancelled,
    })
    .select('id')
    .single()

  // (b) 사용 포인트 환급. 이미 환급한 누적분(orders.points_refunded, 신규 컬럼이라
  //     typegen 미반영 → cast 읽기)을 상한으로 둬 부분/전량 취소가 중복 환급되지
  //     않게 한다(점검: 부분 후 전량취소 라우트가 다시 도므로 상한 필수). 전량(이
  //     라우트에서 마지막 항목까지 취소)은 잔여 전부, 부분은 사용자 지불가치(현금+
  //     포인트) 대비 취소 비율만큼.
  let pointsRefundedNow = 0
  let alreadyRefunded = 0
  if (order.points_used && order.points_used > 0) {
    const { data: prRow } = await (admin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { points_refunded: number | null } | null
            }>
          }
        }
      }
    })
      .from('orders')
      .select('points_refunded')
      .eq('id', order.id)
      .maybeSingle()
    alreadyRefunded = prRow?.points_refunded ?? 0
    const pointsToRefund = computePointsRefund({
      pointsUsed: order.points_used,
      alreadyRefunded,
      totalAmount: order.total_amount ?? 0,
      cancelAmount: claimedCancelAmount,
      fully: fullyCancelled,
    })
    if (pointsToRefund > 0 && refundRow?.id) {
      const result = await appendLedger(admin, {
        userId: user.id,
        delta: pointsToRefund,
        reason: fullyCancelled ? '주문 취소 포인트 환급' : '부분 취소 포인트 환급',
        referenceType: 'order_refund_credit',
        referenceId: refundRow.id,
      })
      if (result.ok) {
        pointsRefundedNow = pointsToRefund
      } else {
        // refunds.id 는 유일하므로 already_applied 면 비정상 — 운영자 인지 필요.
        console.error(
          `[cancel-items] point refund unexpectedly blocked: order=${order.id} refund=${refundRow.id} amount=${pointsToRefund} reason=${result.reason}`,
        )
      }
    }
  }

  // (c) 전량 취소면 쿠폰 사용 회수 — 부분 취소는 잔여 주문에 쿠폰이 여전히 유효해
  //     유지(점검 medium: cancel-items 의 전량 도달 시 쿠폰 미회수였음).
  if (fullyCancelled && order.coupon_code) {
    await revokeCouponRedemption(admin, { couponCode: order.coupon_code })
  }

  // (d) 주문 상태 갱신 — refunded_amount + (전량이면)취소상태 + points_refunded 누적.
  const orderUpdate: Record<string, unknown> = {
    refunded_amount: newRefundedAmount,
  }
  if (pointsRefundedNow > 0) {
    orderUpdate.points_refunded = alreadyRefunded + pointsRefundedNow
  }
  if (fullyCancelled) {
    orderUpdate.payment_status = 'cancelled'
    orderUpdate.order_status = 'cancelled'
    orderUpdate.cancelled_at = nowIso
    orderUpdate.cancel_reason = reason || '고객 부분 취소 (전량)'
  } else {
    // R82-G2: 부분 환불 시 payment_status 도 'partially_refunded' 로 명시.
    // 'partially_refunded' 가 webhook / admin/partial-cancel / reconcile 표준 enum.
    orderUpdate.payment_status = 'partially_refunded'
  }
  // audit #79: orders Record<string, unknown> 호환 cast.
  await (admin as unknown as {
    from: (t: string) => {
      update: (r: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<unknown>
      }
    }
  })
    .from('orders')
    .update(orderUpdate)
    .eq('id', order.id)

  // R60 — 결제 원장 event. 부분 환불 (-claimedCancelAmount) 또는 전량 환불.
  {
    const { recordPaymentEvent } = await import('@/lib/payment-events')
    await recordPaymentEvent(admin, {
      orderId: order.id,
      paymentKey: order.payment_key ?? null,
      eventType: fullyCancelled ? 'refunded' : 'partial_refunded',
      amount: -claimedCancelAmount,
      prevStatus: order.payment_status,
      // R82-G2: payment_status enum 통일 — 'partial_refund' → 'partially_refunded'
      newStatus: fullyCancelled ? 'cancelled' : 'partially_refunded',
      source: 'partial_cancel',
      actorUserId: user.id,
      metadata: {
        reason: reason ?? null,
        itemIds: claimedIds,
        tossTransactionKey,
      },
    })
  }

  // 9) 이메일 안내 — fire-and-forget.
  notifyOrderCancelled(supabase, {
    orderId: order.id,
    userId: user.id,
    orderNumber: order.order_number,
    recipientName: order.recipient_name ?? null,
    totalAmount: order.total_amount,
    reason: fullyCancelled
      ? reason ?? '고객 부분 취소 (전량)'
      : `부분 취소: ${claimedItems
          .map((it) => `${it.product_name} ×${it.quantity}`)
          .join(', ')}`,
    refundAmount: claimedCancelAmount,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    cancelledItemCount: claimedItems.length,
    refundAmount: claimedCancelAmount,
    fullyCancelled,
  })
}
