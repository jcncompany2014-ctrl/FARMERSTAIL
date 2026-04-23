import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { creditPoints } from '@/lib/commerce/points'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ConfirmBody = {
  paymentKey: string
  orderId: string
  amount: number
}

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
    .select('id, total_amount, payment_status, user_id, points_earned')
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

  // 3) 토스페이먼츠 승인 API 호출
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { code: 'SERVER_CONFIG', message: '서버 설정 오류 (시크릿 키 없음)' },
      { status: 500 }
    )
  }

  const encryptedSecret = Buffer.from(`${secretKey}:`).toString('base64')

  const tossRes = await fetch(
    'https://api.tosspayments.com/v1/payments/confirm',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encryptedSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      cache: 'no-store',
    }
  )

  const tossData = await tossRes.json()

  if (!tossRes.ok) {
    // 승인 실패 → 주문 상태 failed로
    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('id', order.id)

    return NextResponse.json(
      {
        code: tossData?.code ?? 'TOSS_ERROR',
        message: tossData?.message ?? '결제 승인에 실패했습니다',
      },
      { status: 400 }
    )
  }

  // 4) 주문 상태 업데이트 — 가상계좌는 아직 입금 전이라 'paid'로 넘기면 안 됨.
  //    WAITING_FOR_DEPOSIT 상태는 'pending'으로 유지하고, 실제 입금 시
  //    /api/payments/webhook이 'paid'로 승격시킴.
  const method: string | undefined = tossData?.method
  const approvedAt: string | undefined = tossData?.approvedAt
  const tossStatus: string | undefined = tossData?.status
  const isActuallyPaid = tossStatus === 'DONE'
  // Toss 승인 응답의 receipt.url — 카드/가상계좌 공통으로 제공되는
  // 공식 거래증빙 URL. 주문 상세에서 "영수증 보기" 링크로 노출한다.
  const receiptUrl: string | null = tossData?.receipt?.url ?? null

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: isActuallyPaid ? 'paid' : 'pending',
      payment_method: method ?? null,
      payment_key: paymentKey,
      paid_at: isActuallyPaid
        ? (approvedAt ?? new Date().toISOString())
        : null,
      order_status: isActuallyPaid ? 'preparing' : 'pending',
      receipt_url: receiptUrl,
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

  return NextResponse.json({
    ok: true,
    status: tossStatus ?? 'UNKNOWN',
    waitingForDeposit: !isActuallyPaid,
  })
}