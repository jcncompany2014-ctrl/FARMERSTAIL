import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, total_amount, payment_status, user_id')
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

  // 4) 주문 상태 업데이트
  const method: string | undefined = tossData?.method
  const approvedAt: string | undefined = tossData?.approvedAt

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_method: method ?? null,
      payment_key: paymentKey,
      paid_at: approvedAt ?? new Date().toISOString(),
      order_status: 'preparing',
    })
    .eq('id', order.id)

  if (updateError) {
    return NextResponse.json(
      { code: 'DB_UPDATE_FAILED', message: updateError.message },
      { status: 500 }
    )
  }

  // 5) 장바구니 비우기 (실패해도 결제는 성공이므로 에러 무시)
  await supabase.from('cart_items').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}