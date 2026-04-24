import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { creditPoints } from '@/lib/commerce/points'
import { confirmPayment } from '@/lib/payments/toss'
import { notifyOrderPlaced, notifyVirtualAccountWaiting } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ConfirmBody = {
  paymentKey: string
  orderId: string
  amount: number
}

/**
 * POST /api/payments/confirm
 *
 * 체크아웃 successUrl로 리다이렉트된 직후 호출. 역할:
 *   1. 주문과 paymentKey/amount 일치성 검증(위변조 방지).
 *   2. Toss v1 `/payments/confirm` 호출 (Idempotency-Key 사용 — 같은 요청 반복 시
 *      Toss가 동일 응답을 돌려주므로 새로고침/이중 탭 공격에도 안전).
 *   3. 응답의 status가 DONE이면 paid/preparing으로, WAITING_FOR_DEPOSIT이면
 *      pending으로 유지하며 가상계좌 정보(은행·계좌번호·만료일) 저장.
 *   4. DONE일 때만 포인트 적립. 가상계좌는 입금 확정 시점의 웹훅에서 별도 처리.
 */
export async function POST(req: Request) {
  let body: ConfirmBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 }
    )
  }

  const { paymentKey, orderId, amount } = body

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json(
      { code: 'MISSING_PARAMS', message: '필수 파라미터가 없습니다' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // 1) 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }

  // 2) 주문 검증 (DB 기준)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, payment_status, user_id, points_earned, shipping_fee, recipient_name'
    )
    .eq('order_number', orderId)
    .eq('user_id', user.id)
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  if (order.total_amount !== amount) {
    return NextResponse.json(
      { code: 'AMOUNT_MISMATCH', message: '결제 금액이 일치하지 않습니다' },
      { status: 400 }
    )
  }

  // 이미 승인된 경우 idempotent하게 성공 응답
  if (order.payment_status === 'paid') {
    return NextResponse.json({ ok: true, alreadyPaid: true })
  }

  // 3) 토스페이먼츠 승인 API 호출 — lib/payments/toss 가 Idempotency-Key 포함.
  const result = await confirmPayment({ paymentKey, orderId, amount })

  if (!result.ok) {
    // 승인 실패 → 주문 상태 failed로
    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('id', order.id)

    return NextResponse.json(
      { code: result.error.code, message: result.error.message },
      { status: 400 }
    )
  }

  const payment = result.data

  // 4) 주문 상태 업데이트 — 가상계좌는 아직 입금 전이라 'paid'로 넘기면 안 됨.
  //    WAITING_FOR_DEPOSIT 상태는 'pending'으로 유지하고, 실제 입금 시
  //    /api/payments/webhook이 'paid'로 승격시킴.
  const isActuallyPaid = payment.status === 'DONE'
  const isWaitingDeposit = payment.status === 'WAITING_FOR_DEPOSIT'

  // 가상계좌 발급 정보. 입금 전까지 사용자에게 계좌 안내를 할 수 있도록 저장.
  const va = payment.virtualAccount
  const vaFields = isWaitingDeposit && va
    ? {
        virtual_account_bank: va.bankCode ?? null,
        virtual_account_number: va.accountNumber ?? null,
        virtual_account_due_date: va.dueDate ?? null,
        virtual_account_holder: va.customerName ?? null,
      }
    : {}

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: isActuallyPaid ? 'paid' : 'pending',
      payment_method: payment.method ?? null,
      payment_key: paymentKey,
      paid_at: isActuallyPaid
        ? (payment.approvedAt ?? new Date().toISOString())
        : null,
      order_status: isActuallyPaid ? 'preparing' : 'pending',
      receipt_url: payment.receipt?.url ?? null,
      ...vaFields,
    })
    .eq('id', order.id)

  if (updateError) {
    return NextResponse.json(
      { code: 'DB_UPDATE_FAILED', message: updateError.message },
      { status: 500 }
    )
  }

  // 5) 포인트 적립 — 실제 결제 완료(DONE)일 때만. 가상계좌는 입금 웹훅에서 처리.
  if (isActuallyPaid && order.points_earned && order.points_earned > 0) {
    await creditPoints(supabase, {
      userId: user.id,
      amount: order.points_earned,
      reason: '주문 결제 적립',
      referenceType: 'order',
      referenceId: order.id,
    })
  }

  // 6) 장바구니 비우기 (가상계좌 포함 — 입금 대기 중에도 재주문 방지)
  await supabase.from('cart_items').delete().eq('user_id', user.id)

  // 7) 웹푸시 알림 — 실제 결제가 끝난 경우에만 "완료" 메시지를 보냄.
  //    가상계좌는 입금 전이니 별도의 "입금 대기" 안내는 주문 상세에서 처리.
  if (isActuallyPaid) {
    pushToUser(user.id, {
      title: '결제가 완료됐어요 🐾',
      body: `${amount.toLocaleString()}원 결제가 정상 처리됐어요. 주문 상세를 확인해 주세요.`,
      url: `/mypage/orders/${order.id}`,
      tag: `order-${order.id}`,
    }).catch(() => {
      /* 푸시는 베스트 에포트 */
    })
  }

  // 8) 이메일 알림 — DONE 이면 주문 접수 메일, WAITING_FOR_DEPOSIT 이면 입금 안내.
  //    fire-and-forget. 메일 실패가 주문 응답을 늦추지 않도록 await 하지 않음.
  if (isActuallyPaid) {
    notifyOrderPlaced(supabase, {
      orderId: order.id,
      userId: user.id,
      orderNumber: order.order_number,
      recipientName: order.recipient_name ?? null,
      totalAmount: order.total_amount,
      shippingFee: order.shipping_fee ?? 0,
      paymentMethod: payment.method ?? null,
    }).catch(() => {
      /* 메일은 베스트 에포트 */
    })
  } else if (isWaitingDeposit && va?.accountNumber) {
    notifyVirtualAccountWaiting(supabase, {
      orderId: order.id,
      userId: user.id,
      orderNumber: order.order_number,
      recipientName: order.recipient_name ?? null,
      totalAmount: order.total_amount,
      bankCode: va.bankCode ?? null,
      accountNumber: va.accountNumber,
      accountHolder: va.customerName ?? null,
      dueDate: va.dueDate ?? null,
    }).catch(() => {
      /* 메일은 베스트 에포트 */
    })
  }

  return NextResponse.json({
    ok: true,
    status: payment.status,
    waitingForDeposit: isWaitingDeposit,
  })
}
