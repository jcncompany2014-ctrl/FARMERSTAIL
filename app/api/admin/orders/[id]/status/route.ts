import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  ORDER_STATUS_LABEL,
  isPaymentStatus,
  type OrderStatus,
} from '@/lib/commerce/order-fsm'
import { carrierLabel, isCarrierCode } from '@/lib/tracking'
import {
  notifyOrderCancelled,
  notifyOrderDelivered,
  notifyOrderShipped,
} from '@/lib/email'
import { recordAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

type TransitionBody = {
  orderStatus: OrderStatus
  carrier?: string | null
  trackingNumber?: string | null
  reason?: string | null
}

// 택배사 라벨/코드 검증은 lib/tracking 으로 일원화.

export async function POST(
  req: Request,
  { params }: { params: Params }
) {
  const { id } = await params

  let body: TransitionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 }
    )
  }

  const { orderStatus, carrier, trackingNumber, reason } = body

  // 'pending' 도 FSM 상태이긴 하지만 관리자가 수동으로 pending 으로 되돌리는 경우는 없음.
  // 허용 범위는 FSM이 canTransition으로 자동 거부하므로 여기서는 enum만 검증.
  if (!isOrderStatus(orderStatus)) {
    return NextResponse.json(
      { code: 'INVALID_STATUS', message: '올바르지 않은 상태값입니다' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // 1) 관리자 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }

  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 }
    )
  }

  // 2) 주문 조회 — admin RLS policy로 전체 접근 가능
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, user_id, payment_status, order_status, total_amount, shipped_at, delivered_at, cancelled_at, recipient_name, refunded_amount, carrier, tracking_number'
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // 3) 전환 가드 — FSM에 일임. delivered/cancelled terminal, 결제 미완 가드 등
  //    모든 규칙이 canTransitionOrderStatus 안에 있음.
  if (!isOrderStatus(order.order_status) || !isPaymentStatus(order.payment_status)) {
    return NextResponse.json(
      { code: 'INVALID_DB_STATE', message: '주문 상태가 손상돼 있어요' },
      { status: 500 }
    )
  }

  const transition = canTransitionOrderStatus(order.order_status, orderStatus, {
    payment_status: order.payment_status,
    actor: 'admin',
  })
  if (!transition.ok) {
    return NextResponse.json(
      { code: 'INVALID_TRANSITION', message: transition.reason },
      { status: 400 }
    )
  }

  // 4) 전환에 따른 필드 업데이트 스냅샷
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { order_status: orderStatus }

  // 발송 알림에 실을 운송장 — body 에 없으면 이미 저장된 값을 쓴다.
  let shipCarrier: string | null = null
  let shipTracking: string | null = null

  if (orderStatus === 'shipping') {
    // ★송장 없이 발송 처리하지 않는다 (2026-08-07 어드민 감사).
    //  '주문 상태 관리' 패널은 carrier/trackingNumber 없이 이 라우트를 부를 수
    //  있었다. 그러면 고객에게 "배송이 시작됐어요" 가 나가는데 운송장은 비어
    //  있고, 조회할 방법이 없다. 발송은 '발송 처리' 패널에서 송장과 함께 한다.
    const nextTracking =
      trackingNumber !== undefined
        ? (trackingNumber ?? '').trim()
        : (order.tracking_number ?? '')
    const nextCarrier =
      carrier !== undefined ? (carrier ?? '').trim() : (order.carrier ?? '')
    if (!nextTracking || !nextCarrier) {
      return NextResponse.json(
        {
          code: 'TRACKING_REQUIRED',
          message:
            '발송 처리에는 택배사와 송장번호가 필요해요. 주문 상세의 “발송 처리” 패널에서 입력해 주세요.',
        },
        { status: 400 },
      )
    }

    update.shipped_at = order.shipped_at ?? now
    // 택배사/송장번호는 선택 입력 — 값이 넘어오면 저장, 공란이면 명시적으로 null 로.
    // carrier 코드는 lib/tracking::isCarrierCode 로 화이트리스트 검증.
    if (carrier !== undefined) {
      const trimmed = carrier?.trim()
      if (trimmed && !isCarrierCode(trimmed)) {
        return NextResponse.json(
          { code: 'INVALID_CARRIER', message: '지원하지 않는 택배사예요' },
          { status: 400 }
        )
      }
      update.carrier = trimmed || null
    }
    if (trackingNumber !== undefined)
      update.tracking_number = trackingNumber?.trim() || null

    shipCarrier = nextCarrier
    shipTracking = nextTracking
  } else if (orderStatus === 'delivered') {
    update.delivered_at = order.delivered_at ?? now
    // delivered는 shipping 을 건너뛰고 바로 찍혀도 되지만, shipped_at은 한 번은 남겨둡니다.
    if (!order.shipped_at) update.shipped_at = now
  } else if (orderStatus === 'cancelled') {
    // R93 (D7): 결제 완료(paid) / 부분환불(partially_refunded) 주문을 이
    // 경로로 취소하면 Toss 환불 / 재고 복원 / 포인트 환급·회수 / 쿠폰 원복
    // 이 전부 누락된다 (이 분기는 cancelled_at 만 set). 그 결과 고객은 결제
    // 된 채 방치되고 재고·쿠폰·포인트 정합성이 조용히 깨진다.
    //
    // 환불이 필요한 주문은 "부분취소/환불" 패널(partial-cancel route)에서
    // 처리해야 한다 — 그쪽은 Toss cancelPayment + refunded_amount +
    // payment_events ledger 를 제대로 기록한다. 따라서 결제완료 주문의
    // status-route 취소는 막고 환불 패널로 유도한다.
    //
    // 이 분기의 cancelled 는 미결제(pending) / 결제실패(failed) 주문 취소
    // 에만 안전하다 (환불할 돈이 없으므로 누락 사고가 없음).
    if (
      order.payment_status === 'paid' ||
      order.payment_status === 'partially_refunded'
    ) {
      return NextResponse.json(
        {
          code: 'REFUND_REQUIRED',
          message:
            '결제가 완료된 주문은 환불 처리가 필요해요. 주문 상세의 “부분취소/환불” 패널에서 환불 금액(전액 가능)을 지정해 취소해 주세요.',
        },
        { status: 400 },
      )
    }
    update.cancelled_at = order.cancelled_at ?? now
    if (reason !== undefined) update.cancel_reason = reason?.trim() || null
  } else if (orderStatus === 'preparing') {
    // 되돌리기(shipping → preparing)는 드물지만 허용. 발송 타임스탬프는 남겨 둡니다.
  }

  /**
   * ★ 쓰기는 service_role 로 (2026-07-31).
   *
   * `orders` 는 결제 원장이라 컬럼 UPDATE 권한을 회수했다(20260731000000).
   * 이 라우트는 쿠키 클라이언트를 쓰고 있어서, 회수 후에는 order_status·
   * shipped_at·carrier 같은 칸을 못 써 **관리자 주문 상태 변경이 통째로
   * 죽는다** — 권한을 잠글 때 그 칸을 쓰던 코드가 조용히 죽는 것이 오늘 실제로
   * 겪은 사고다(카드 등록이 그렇게 죽어 있었다).
   * 관리자 인증은 위(:64~)에서 이미 끝났고, RLS 대신 그 검증이 범위를 책임진다.
   */
  // ★원자적 선점(CAS) — 스냅샷 이후 다른 요청(고객 취소·부분환불·만료 크론)이
  //   상태를 바꿨으면 0행으로 bail (2026-08-20 6라운드 감사). 형제 라우트
  //   (orders/cancel · partial-cancel · order-expire)는 전부 이 가드가 있는데
  //   어드민 상태변경만 `.eq('id')` 뿐이라, 예: 고객이 먼저 취소해 'cancelled'
  //   가 된 주문을 어드민이 'shipping' 으로 덮어 취소된 주문을 발송할 수 있었다.
  const { data: claimed, error: updateError } = await (
    createAdminClient() as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              eq: (
                c: string,
                v: string,
              ) => {
                select: (
                  c: string,
                ) => Promise<{
                  data: Array<{ id: string }> | null
                  error: { message?: string } | null
                }>
              }
            }
          }
        }
      }
    }
  )
    .from('orders')
    .update(update)
    .eq('id', id)
    .eq('order_status', order.order_status)
    .eq('payment_status', order.payment_status)
    .select('id')

  if (updateError) {
    return dbError(updateError, 'admin_order_status', '주문 상태 변경에 실패했어요')
  }
  if (!claimed || claimed.length === 0) {
    // 0행 = 그 사이 다른 흐름이 상태를 바꿨다. 덮어쓰지 않고 알린다.
    return NextResponse.json(
      {
        code: 'CONFLICT',
        message:
          '그 사이 주문 상태가 바뀌었어요. 새로고침 후 현재 상태를 확인해 주세요.',
      },
      { status: 409 },
    )
  }

  // 5) 고객 푸시 알림 (배송 시작 · 배송 완료 · 취소). 실패해도 전환은 성공.
  if (
    orderStatus === 'shipping' ||
    orderStatus === 'delivered' ||
    orderStatus === 'cancelled'
  ) {
    const carrierName = carrierLabel(shipCarrier)
    const trimmedTracking = shipTracking ?? ''

    const title =
      orderStatus === 'shipping'
        ? '배송이 시작됐어요 📦'
        : orderStatus === 'delivered'
          ? '배송이 완료됐어요 🐾'
          : '주문이 취소됐어요'

    const bodyText =
      orderStatus === 'shipping'
        ? carrierName && trimmedTracking
          ? `${carrierName} · ${trimmedTracking}`
          : '운송장 정보는 주문 상세에서 확인할 수 있어요'
        : orderStatus === 'delivered'
          ? '파머스테일과 함께한 주문이 잘 도착했어요. 맛있게 드셨길 바라요!'
          : `주문 ${order.order_number}가 취소됐어요${
              reason ? ` · ${reason}` : ''
            }`

    pushToUser(
      order.user_id,
      {
        title,
        body: bodyText,
        url: `/mypage/orders/${order.id}`,
        tag: `order-${order.id}-${orderStatus}`,
      },
      { category: 'order' },
    ).catch(() => {
      /* 푸시는 베스트 에포트 */
    })

    // 같은 이벤트에 대한 이메일 알림. fire-and-forget.
    if (orderStatus === 'shipping') {
      notifyOrderShipped(supabase, {
        orderId: order.id,
        userId: order.user_id,
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? null,
        totalAmount: order.total_amount,
        carrier: shipCarrier,
        trackingNumber: shipTracking,
      }).catch(() => {})
    } else if (orderStatus === 'delivered') {
      notifyOrderDelivered(supabase, {
        orderId: order.id,
        userId: order.user_id,
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? null,
        totalAmount: order.total_amount,
      }).catch(() => {})
    } else if (orderStatus === 'cancelled') {
      notifyOrderCancelled(supabase, {
        orderId: order.id,
        userId: order.user_id,
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? null,
        totalAmount: order.total_amount,
        reason: reason?.trim() || null,
        refundAmount: order.refunded_amount ?? null,
      }).catch(() => {})
    }
  }

  // Audit log — order status 변경은 cs 추적에 필수. fail-silent.
  await recordAdminAction(supabase, {
    action: 'order_status_change',
    entityType: 'order',
    entityId: order.id,
    diff: {
      before: { order_status: order.order_status },
      after: { order_status: orderStatus },
      meta: {
        order_number: order.order_number,
        carrier: carrier ?? null,
        tracking_number: trackingNumber ?? null,
        reason: reason ?? null,
      },
    },
    req,
  })

  return NextResponse.json({
    ok: true,
    orderStatus,
    label: ORDER_STATUS_LABEL[orderStatus] ?? orderStatus,
  })
}
