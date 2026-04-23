import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { isAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

type TransitionBody = {
  orderStatus: 'preparing' | 'shipping' | 'delivered' | 'cancelled'
  carrier?: string | null
  trackingNumber?: string | null
  reason?: string | null
}

const VALID_STATUSES = new Set(['preparing', 'shipping', 'delivered', 'cancelled'])

const STATUS_LABEL_KO: Record<string, string> = {
  preparing: '준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '주문 취소',
}

const CARRIER_LABEL_KO: Record<string, string> = {
  cj: 'CJ대한통운',
  post: '우체국택배',
  lotte: '롯데택배',
  hanjin: '한진택배',
  logen: '로젠택배',
  kd: '경동택배',
  other: '기타',
}

function carrierLabel(code: string | null | undefined) {
  if (!code) return null
  return CARRIER_LABEL_KO[code] ?? code
}

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

  if (!orderStatus || !VALID_STATUSES.has(orderStatus)) {
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
      'id, order_number, user_id, payment_status, order_status, total_amount, shipped_at, delivered_at, cancelled_at'
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // 3) 전환 가드 — cancelled/delivered로 끝난 주문은 일반 관리자가 되돌릴 수 없음
  if (order.order_status === 'cancelled' && orderStatus !== 'cancelled') {
    return NextResponse.json(
      {
        code: 'ALREADY_CANCELLED',
        message: '취소된 주문은 다시 활성화할 수 없습니다',
      },
      { status: 400 }
    )
  }

  // 배송·완료는 결제가 끝난 주문에만 허용
  if (
    (orderStatus === 'shipping' || orderStatus === 'delivered') &&
    order.payment_status !== 'paid'
  ) {
    return NextResponse.json(
      {
        code: 'NOT_PAID',
        message: '결제가 완료되지 않은 주문은 발송/완료 처리할 수 없어요',
      },
      { status: 400 }
    )
  }

  // 4) 전환에 따른 필드 업데이트 스냅샷
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { order_status: orderStatus }

  if (orderStatus === 'shipping') {
    update.shipped_at = order.shipped_at ?? now
    // 택배사/송장번호는 선택 입력 — 값이 넘어오면 저장, 공란이면 명시적으로 null 로.
    if (carrier !== undefined) update.carrier = carrier?.trim() || null
    if (trackingNumber !== undefined)
      update.tracking_number = trackingNumber?.trim() || null
  } else if (orderStatus === 'delivered') {
    update.delivered_at = order.delivered_at ?? now
    // delivered는 shipping 을 건너뛰고 바로 찍혀도 되지만, shipped_at은 한 번은 남겨둡니다.
    if (!order.shipped_at) update.shipped_at = now
  } else if (orderStatus === 'cancelled') {
    update.cancelled_at = order.cancelled_at ?? now
    if (reason !== undefined) update.cancel_reason = reason?.trim() || null
  } else if (orderStatus === 'preparing') {
    // 되돌리기(shipping → preparing)는 드물지만 허용. 발송 타임스탬프는 남겨 둡니다.
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update(update)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: updateError.message },
      { status: 500 }
    )
  }

  // 5) 고객 푸시 알림 (배송 시작 · 배송 완료 · 취소). 실패해도 전환은 성공.
  if (
    orderStatus === 'shipping' ||
    orderStatus === 'delivered' ||
    orderStatus === 'cancelled'
  ) {
    const carrierName = carrierLabel(carrier ?? null)
    const trimmedTracking = (trackingNumber ?? '').trim()

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
          ? '파머스테일과 함께한 주문이 잘 도착했어요. 리뷰 남겨주시면 포인트 적립!'
          : `주문 ${order.order_number}가 취소됐어요${
              reason ? ` · ${reason}` : ''
            }`

    pushToUser(order.user_id, {
      title,
      body: bodyText,
      url: `/mypage/orders/${order.id}`,
      tag: `order-${order.id}-${orderStatus}`,
    }).catch(() => {
      /* 푸시는 베스트 에포트 */
    })
  }

  return NextResponse.json({
    ok: true,
    orderStatus,
    label: STATUS_LABEL_KO[orderStatus] ?? orderStatus,
  })
}
