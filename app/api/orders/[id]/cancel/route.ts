import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  isPaymentStatus,
} from '@/lib/commerce/order-fsm'
import { cancelPayment } from '@/lib/payments/toss'
import { notifyOrderCancelled } from '@/lib/email'
import { zOrderCancel } from '@/lib/api/schemas'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import {
  tagSentryUser,
  tagSentryRoute,
  captureBusinessEvent,
} from '@/lib/sentry/trace'

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
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Rate limit — 자기 주문이라도 폭주 시 Toss/이메일까지 호출되니
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

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, payment_status, order_status, payment_key, payment_method, total_amount, recipient_name, subscription_id'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // ★조회 실패를 "그런 주문 없음" 으로 말하지 않는다(AGENTS 규칙1, 2026-08-02).
  //   예전엔 error 를 안 꺼내 DB 가 흔들리면 order 가 null 이 됐고, 주문이
  //   멀쩡히 있는 고객이 "주문을 찾을 수 없어요" 를 읽었다. 취소하려던 사람에게
  //   가장 불안한 문장이다. 실패는 실패라고 말하고 재시도를 안내한다.
  if (orderErr) {
    return NextResponse.json(
      {
        code: 'ORDER_LOOKUP_FAILED',
        message: '일시적인 오류로 주문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
      },
      { status: 503 }
    )
  }
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
  /**
   * ★★ 쓰기는 service_role 로, 그리고 **error 를 반드시 가른다** (2026-07-31).
   *
   * 예전엔 쿠키 클라이언트로 쓰고 `const { data: cancelRows }` 로 error 를
   * 버렸다. 그래서 UPDATE 가 실패하면 cancelRows 가 null 이 되어 아래
   * "이미 처리된 주문이에요"(409) 분기로 빠졌다 — **토스 환불은 이미 성공한
   * 뒤다.** 즉 돈은 돌려주고 주문은 결제완료로 남으며, 고객에게는 엉뚱한
   * 안내가 나간다. 우리 장부와 토스 장부가 갈라지고 아무도 모른다.
   *
   * 게다가 `orders` 는 20260731000000 에서 컬럼 UPDATE 권한을 회수했으므로
   * 쿠키 클라이언트로는 **이제 반드시 실패**한다. 본인 주문 검증은 위(:74~)에서
   * 이미 끝났고, 그 검증이 범위를 책임진다.
   */
  const admin = createAdminClient()
  const { data: cancelRows, error: cancelErr } = await admin
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

  if (cancelErr) {
    /**
     * ★ 실패를 '이미 처리됨'으로 말하지 않는다. 환불은 이미 나갔으므로 이건
     * **사람이 즉시 봐야 하는** 상태다 — 우리 주문은 결제완료로 남아 있고
     * 고객 돈은 돌아갔다.
     */
    captureBusinessEvent('error', 'order.cancel.db_update_failed', {
      orderId: order.id,
      userId: user.id,
      refundAmount,
      dbError: cancelErr.message,
    })
    return NextResponse.json(
      {
        code: 'CANCEL_SAVE_FAILED',
        message:
          '결제 취소는 됐는데 주문 상태 저장에 실패했어요. 고객센터로 알려주시면 바로 정리해 드릴게요.',
      },
      { status: 500 },
    )
  }

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
    /**
     * ★ admin 으로 기록한다 (2026-07-31). `payment_events` 는 RLS 가 켜져 있고
     * **authenticated INSERT 정책이 없다**(lib/payment-events.ts 주석이 그렇게
     * 명시한다: "service_role 만 INSERT"). 쿠키 클라이언트로 넘기면 insert 가
     * 거부되고, 이 함수는 best-effort 라 반환값도 버려져 **환불이 결제 원장에
     * 한 줄도 안 남았다** — SUM(amount)=0 으로 완전 환불을 검증하는 구조인데
     * 그 검증이 성립하지 않는다.
     */
    const ledger = await recordPaymentEvent(admin, {
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
    if (!ledger.ok) {
      // 원장은 best-effort 라 흐름을 막지 않는다(환불·주문 상태는 이미 정리됐다).
      // 다만 조용히 넘기지 않는다 — SUM(amount)=0 으로 완전 환불을 검증하는
      // 구조라, 한 줄이 빠지면 그 검증이 영영 성립하지 않는다.
      captureBusinessEvent('error', 'order.cancel.ledger_write_failed', {
        orderId: order.id,
        userId: user.id,
        refundAmount,
        reason: ledger.reason,
      })
    }
  }

  // 2b) 항목 단위 cancelled_at 마킹 + stock 복원 + refunds audit row.
  // RLS 우회 필요 작업 (stock RPC + refunds insert) 은 admin client.
  // 본인 주문 검증은 위에서 이미 완료.
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
    /**
     * ★재고 복원은 **예약이 있었던 주문만** (2026-08-08 동시성 감사).
     *
     * 구독 청구가 만든 주문은 재고를 **차감하지 않는다**(reserve_order_stock
     * 호출처가 낱개 커머스 폐지로 0이 됐다). 그런데 취소는 무조건
     * restore_stock 을 불러서 — **결제된 주문을 취소할 때마다 재고가 유령
     * 증가**했다. 경합이 아니라 취소마다 확정 발생이다.
     * order-expire 는 같은 이유로 `subscription_id === null` gate 를 이미
     * 달았다(그쪽 주석 참조) — 여기만 남아 있었다.
     */
    const reservedStock =
      (order as { subscription_id?: string | null }).subscription_id == null
    for (const it of itemsArr) {
      await admin
        .from('order_items')
        .update({ refunded_amount: it.line_total })
        .eq('id', it.id)
      if (!reservedStock) continue
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

  // 3~5) 포인트 환급/회수 제거 (2026-07-16 포인트 전면 폐기).
  //    주문에 쓴 포인트 환급 + 적립 포인트 회수를 하던 자리인데, 포인트 개념 자체가
  //    사라졌다(구독 결제로는 애초에 적립되지도 않았다). 결제 취소·재고 복원·환불은
  //    위에서 이미 처리된다.

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
      // best-effort 기록. 실패를 "강아지 없음" 과 섞지 않도록 error 를 꺼낸다.
      const { data: dogRow, error: dogErr } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (dogErr) {
        captureBusinessEvent('warning', 'order.cancel.outcome_record_skipped', {
          orderId: order.id,
          reason: 'dogs_lookup_failed',
        })
      }
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
