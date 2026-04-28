import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/orders/[id]/partial-cancel
 *
 * 관리자가 주문의 일부 금액을 환불한다.
 *   • Toss cancelAmount를 지정해서 부분 취소 요청
 *   • refunded_amount 누적 + payment_status 전환
 *       - refunded_amount < total_amount → 'partially_refunded'
 *       - refunded_amount == total_amount → 'refunded'
 *   • 가상계좌 주문은 refundReceiveAccount(환불 계좌 정보)가 필수 —
 *     body에 전달된 계좌 정보를 그대로 Toss에 패스. 카드 결제는 불필요.
 *   • 포인트/쿠폰은 부분 취소에서 자동 조정하지 않는다 (금액 분배
 *     로직이 복잡하고 운영자가 컨텍스트에 맞춰 수동 처리하는 쪽이
 *     에러가 적음). 전액 환불이 필요하면 기존 /api/orders/[id]/cancel
 *     플로우를 사용.
 *
 * 권한: profiles.role = 'admin'만 허용.
 */

type Body = {
  cancelAmount: number
  cancelReason?: string
  refundReceiveAccount?: {
    bank: string // Toss 은행 코드 (예: "88" 신한)
    accountNumber: string
    holderName: string
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 }
    )
  }

  const { cancelAmount, cancelReason, refundReceiveAccount } = body

  if (
    typeof cancelAmount !== 'number' ||
    !Number.isFinite(cancelAmount) ||
    cancelAmount <= 0
  ) {
    return NextResponse.json(
      { code: 'INVALID_AMOUNT', message: '취소 금액은 0원보다 커야 합니다' },
      { status: 400 }
    )
  }

  // 관리자 권한 확인 — JWT app_metadata.role 우선, profiles.role fallback.
  // 자세한 배경은 lib/auth/admin.ts.
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
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 }
    )
  }

  // 이제부터는 admin 클라이언트로 — RLS 우회해서 어떤 주문이든 조회/갱신.
  const admin = createAdminClient()

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      'id, user_id, payment_status, payment_method, payment_key, total_amount, refunded_amount'
    )
    .eq('id', id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  if (!order.payment_key) {
    return NextResponse.json(
      { code: 'NO_PAYMENT_KEY', message: '결제 정보가 없어 환불할 수 없습니다' },
      { status: 400 }
    )
  }

  // 이미 완료 상태 외의 주문은 부분 환불 대상이 아님.
  if (
    order.payment_status !== 'paid' &&
    order.payment_status !== 'partially_refunded'
  ) {
    return NextResponse.json(
      {
        code: 'NOT_REFUNDABLE',
        message: '결제 완료된 주문만 부분 환불이 가능합니다',
      },
      { status: 400 }
    )
  }

  const remaining = order.total_amount - (order.refunded_amount ?? 0)
  if (cancelAmount > remaining) {
    return NextResponse.json(
      {
        code: 'AMOUNT_EXCEEDS_REMAINING',
        message: `환불 가능 잔액(${remaining.toLocaleString()}원)을 초과했습니다`,
      },
      { status: 400 }
    )
  }

  // 가상계좌는 환불 수신 계좌가 필수 (입금자가 환불받을 계좌).
  const needsRefundAccount =
    order.payment_method === '가상계좌' ||
    order.payment_method === 'VIRTUAL_ACCOUNT' ||
    order.payment_method === '계좌이체' ||
    order.payment_method === 'TRANSFER'
  if (needsRefundAccount && !refundReceiveAccount) {
    return NextResponse.json(
      {
        code: 'REFUND_ACCOUNT_REQUIRED',
        message: '가상계좌/계좌이체 환불은 환불 수신 계좌 정보가 필요합니다',
      },
      { status: 400 }
    )
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { code: 'SERVER_CONFIG', message: '서버 설정 오류' },
      { status: 500 }
    )
  }
  const basic = Buffer.from(`${secretKey}:`).toString('base64')

  const tossRes = await fetch(
    `https://api.tosspayments.com/v1/payments/${encodeURIComponent(
      order.payment_key
    )}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        // 같은 payment에 대해 여러 번 부분 취소를 보낼 때 네트워크
        // 재시도/더블클릭으로 중복 취소가 발생하지 않도록 멱등 키.
        'Idempotency-Key': `partial-cancel-${order.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        cancelReason: cancelReason?.trim() || '부분 환불',
        cancelAmount,
        ...(refundReceiveAccount ? { refundReceiveAccount } : {}),
      }),
      cache: 'no-store',
    }
  )

  // Toss 가 장애시 HTML 500 을 돌려줄 수 있어 JSON 파싱 실패 자체를 삼키면
  // 진짜 원인이 숨는다. 파싱 실패는 로깅하되 UI 로는 일관된 code/message 내려준다.
  let tossData: {
    code?: string
    message?: string
    totalAmount?: number
    balanceAmount?: number
    status?: string
  } = {}
  let tossParseError: unknown = null
  try {
    tossData = await tossRes.json()
  } catch (err) {
    tossParseError = err
  }

  if (!tossRes.ok || tossParseError) {
    if (tossParseError) {
      console.error(
        '[partial-cancel] Toss response JSON parse failed',
        { status: tossRes.status, err: tossParseError },
      )
    }
    return NextResponse.json(
      {
        code: tossData.code ?? 'TOSS_CANCEL_FAILED',
        message:
          tossData.message ??
          (tossParseError
            ? `결제사 응답을 읽지 못했어요 (HTTP ${tossRes.status})`
            : '결제 취소에 실패했습니다'),
      },
      { status: tossParseError ? 502 : 400 }
    )
  }

  // Toss 응답의 balanceAmount(잔액)를 기준으로 우리 DB를 정합.
  // totalAmount - balanceAmount == 누적 환불액.
  const nextRefunded =
    typeof tossData.totalAmount === 'number' &&
    typeof tossData.balanceAmount === 'number'
      ? tossData.totalAmount - tossData.balanceAmount
      : (order.refunded_amount ?? 0) + cancelAmount

  const isFullyRefunded = nextRefunded >= order.total_amount
  const nextStatus = isFullyRefunded ? 'refunded' : 'partially_refunded'

  const { error: updateErr } = await admin
    .from('orders')
    .update({
      refunded_amount: nextRefunded,
      payment_status: nextStatus,
      // 전액 환불 시 cancelled_at/reason을 함께 채움 — 기존 리스트
      // 뷰가 cancelled_at으로 필터링하는 경우를 위해.
      ...(isFullyRefunded
        ? {
            cancelled_at: new Date().toISOString(),
            cancel_reason: cancelReason?.trim() || '전액 환불 처리',
          }
        : {}),
    })
    .eq('id', order.id)

  if (updateErr) {
    return NextResponse.json(
      { code: 'DB_UPDATE_FAILED', message: updateErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    refundedAmount: nextRefunded,
    remainingAmount: order.total_amount - nextRefunded,
    status: nextStatus,
  })
}
