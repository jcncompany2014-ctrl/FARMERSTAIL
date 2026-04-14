import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  paymentKey?: string
  orderId?: string
  amount?: string
}>

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { paymentKey, orderId, amount } = await searchParams

  // 필수 파라미터 검증
  if (!paymentKey || !orderId || !amount) {
    redirect('/checkout/fail?code=MISSING_PARAMS&message=필수%20정보가%20없습니다')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // orders 테이블에서 금액 검증 (위변조 방지)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, payment_status')
    .eq('order_number', orderId)
    .eq('user_id', user.id)
    .single()

  if (orderError || !order) {
    redirect('/checkout/fail?code=ORDER_NOT_FOUND&message=주문을%20찾을%20수%20없습니다')
  }

  if (order.total_amount !== Number(amount)) {
    redirect('/checkout/fail?code=AMOUNT_MISMATCH&message=결제%20금액이%20일치하지%20않습니다')
  }

  // 이미 승인된 주문이면 결과 화면만 보여주기 (중복 승인 방지)
  if (order.payment_status === 'paid') {
    return <SuccessView orderNumber={order.order_number} amount={order.total_amount} />
  }

  // 승인 API 호출 (서버 사이드 fetch)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const confirmRes = await fetch(`${baseUrl}/api/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount: Number(amount),
    }),
    cache: 'no-store',
  })

  if (!confirmRes.ok) {
    const data = await confirmRes.json().catch(() => ({}))
    const code = data?.code ?? 'CONFIRM_FAILED'
    const message = data?.message ?? '결제 승인 실패'
    redirect(
      `/checkout/fail?code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}`
    )
  }

  return <SuccessView orderNumber={order.order_number} amount={order.total_amount} />
}

function SuccessView({
  orderNumber,
  amount,
}: {
  orderNumber: string
  amount: number
}) {
  return (
    <div className="min-h-[70vh] px-5 pt-12 flex flex-col items-center">
      <div className="w-20 h-20 rounded-full bg-[#6B7F3A] flex items-center justify-center text-4xl">
        ✓
      </div>
      <h1 className="mt-6 font-['Archivo_Black'] text-2xl text-[#2A2118]">
        PAYMENT COMPLETE
      </h1>
      <p className="mt-2 text-sm text-[#5C4A3A]">결제가 완료되었어요</p>

      <div className="mt-8 w-full p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <div className="flex justify-between text-sm">
          <span className="text-[#8A7668]">주문번호</span>
          <span className="text-[#2A2118] font-medium">{orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm mt-3">
          <span className="text-[#8A7668]">결제금액</span>
          <span className="font-['Archivo_Black'] text-[#A0452E]">
            {amount.toLocaleString()}원
          </span>
        </div>
      </div>

      <div className="mt-8 w-full space-y-2">
        <Link
          href="/mypage/orders"
          className="block w-full text-center py-4 rounded-full bg-[#A0452E] text-white font-semibold hover:bg-[#8A3822] transition"
        >
          주문 내역 보기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-full bg-white border border-[#EDE6D8] text-[#5C4A3A] font-medium hover:bg-[#F5F0E6] transition"
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  )
}