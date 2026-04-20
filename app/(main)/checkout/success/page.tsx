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

  if (!paymentKey || !orderId || !amount) {
    redirect('/checkout/fail?code=MISSING_PARAMS&message=필수%20정보가%20없습니다')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  if (order.payment_status === 'paid') {
    return <SuccessView orderNumber={order.order_number} amount={order.total_amount} />
  }

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
    <main className="pb-8">
      <section className="px-5 pt-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-[#6B7F3A] flex items-center justify-center text-white text-3xl font-black shadow-[0_6px_20px_rgba(107,127,58,0.3)]">
          ✓
        </div>
        <h1 className="mt-5 text-xl font-black text-[#3D2B1F] tracking-tight">
          결제가 완료됐어요
        </h1>
        <p className="mt-1 text-[12px] text-[#8A7668]">
          주문이 정상적으로 접수되었습니다
        </p>
      </section>

      <section className="px-5 mt-7">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-[#8A7668]">주문번호</span>
            <span className="text-[#3D2B1F] font-bold font-mono">
              {orderNumber}
            </span>
          </div>
          <div className="border-t border-[#EDE6D8] my-3" />
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-black text-[#3D2B1F]">
              결제금액
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-black text-[#A0452E]">
                {amount.toLocaleString()}
              </span>
              <span className="text-[11px] text-[#8A7668]">원</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 mt-4">
        <div className="bg-[#F5F0E6] rounded-xl border border-[#EDE6D8] px-4 py-3">
          <div className="text-[10px] text-[#8A7668] font-bold uppercase tracking-widest">
            배송 안내
          </div>
          <p className="text-[12px] text-[#3D2B1F] mt-1.5 leading-relaxed">
            주문하신 상품은 평일 기준 2~3일 내 출고됩니다.
          </p>
        </div>
      </section>

      <section className="px-5 mt-6 space-y-2">
        <Link
          href="/mypage/orders"
          className="block w-full text-center py-4 rounded-xl bg-[#A0452E] text-white text-[14px] font-black active:scale-[0.98] transition"
        >
          주문 내역 보기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-xl bg-white border border-[#EDE6D8] text-[13px] font-bold text-[#5C4A3A] active:scale-[0.98] transition"
        >
          쇼핑 계속하기
        </Link>
      </section>
    </main>
  )
}
