import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Clock, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PurchaseTracker from './PurchaseTracker'
import type { AnalyticsItem } from '@/lib/analytics'
import {
  bankCodeLabel,
  formatDueDate,
  paymentMethodLabel,
} from '@/lib/payments/toss'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '결제 완료',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{
  paymentKey?: string
  orderId?: string
  amount?: string
}>

// 결제 성공/대기 페이지가 한 번에 표시해야 하는 정보.
// 가상계좌는 `payment_status === 'pending'`인 채로 "입금 대기"
// 상태를 UI로 구분해야 한다.
type OrderForSuccess = {
  id: string
  order_number: string
  total_amount: number
  payment_status: string | null
  payment_method: string | null
  receipt_url: string | null
  shipping_fee: number | null
  coupon_code: string | null
  virtual_account_bank: string | null
  virtual_account_number: string | null
  virtual_account_due_date: string | null
  virtual_account_holder: string | null
}

type OrderItemRow = {
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
}

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
    .select(
      'id, order_number, total_amount, payment_status, payment_method, receipt_url, shipping_fee, coupon_code, virtual_account_bank, virtual_account_number, virtual_account_due_date, virtual_account_holder'
    )
    .eq('order_number', orderId)
    .eq('user_id', user.id)
    .single<OrderForSuccess>()

  if (orderError || !order) {
    redirect('/checkout/fail?code=ORDER_NOT_FOUND&message=주문을%20찾을%20수%20없습니다')
  }

  if (order.total_amount !== Number(amount)) {
    redirect('/checkout/fail?code=AMOUNT_MISMATCH&message=결제%20금액이%20일치하지%20않습니다')
  }

  // 이미 서버에서 상태가 확정된 경우는 confirm을 다시 호출할 필요 없음.
  // 'paid'면 정상 완료, 'pending'이면 가상계좌 입금 대기(confirm API는
  // 이미 첫 콜에서 WAITING_FOR_DEPOSIT을 반환한 상태).
  if (order.payment_status === 'paid' || order.payment_status === 'pending') {
    const items = await loadItems(supabase, order.id)
    return <SuccessView order={order} items={items} />
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

  // Confirm 성공 시 최신 order를 다시 읽어서 receipt_url 등을 반영.
  const { data: fresh } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, payment_status, payment_method, receipt_url, shipping_fee, coupon_code, virtual_account_bank, virtual_account_number, virtual_account_due_date, virtual_account_holder'
    )
    .eq('id', order.id)
    .single<OrderForSuccess>()

  const items = await loadItems(supabase, order.id)
  return <SuccessView order={fresh ?? order} items={items} />
}

async function loadItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string
): Promise<OrderItemRow[]> {
  const { data } = await supabase
    .from('order_items')
    .select('product_id, product_name, unit_price, quantity')
    .eq('order_id', orderId)
  return (data ?? []) as OrderItemRow[]
}

function SuccessView({
  order,
  items,
}: {
  order: OrderForSuccess
  items: OrderItemRow[]
}) {
  // 가상계좌는 결제 "요청"은 성공했지만 실제 "완료"는 입금 후.
  // 화면에서도 이 차이를 명시적으로 보여줘야 사용자가 입금 절차를
  // 빼먹지 않는다.
  const isWaitingDeposit = order.payment_status === 'pending'
  const isPaid = order.payment_status === 'paid'

  const analyticsItems: AnalyticsItem[] = items.map((it) => ({
    item_id: it.product_id,
    item_name: it.product_name,
    price: it.unit_price,
    quantity: it.quantity,
  }))

  return (
    <main className="pb-8">
      {/* 전환 이벤트 — 실제 결제 완료(DONE) 시점에만. 가상계좌 입금
          대기 상태에서는 발송하지 않음. */}
      {isPaid && analyticsItems.length > 0 && (
        <PurchaseTracker
          transactionId={order.order_number}
          value={order.total_amount}
          items={analyticsItems}
          shipping={order.shipping_fee ?? undefined}
          coupon={order.coupon_code}
        />
      )}
      <section className="px-5 pt-10 flex flex-col items-center">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${
            isWaitingDeposit
              ? 'bg-gold shadow-[0_8px_24px_rgba(212,184,114,0.3)]'
              : 'bg-moss shadow-[0_8px_24px_rgba(107,127,58,0.3)]'
          }`}
        >
          {isWaitingDeposit ? (
            <Clock className="w-8 h-8" strokeWidth={2.5} />
          ) : (
            <Check className="w-8 h-8" strokeWidth={3} />
          )}
        </div>
        <span
          className={`kicker mt-6 ${
            isWaitingDeposit ? 'kicker-muted' : 'kicker-moss'
          }`}
        >
          {isWaitingDeposit ? 'Awaiting Deposit · 입금 대기' : 'Payment Complete · 결제 완료'}
        </span>
        <h1
          className="font-serif mt-2 text-center"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {isWaitingDeposit ? '입금을 기다리고 있어요' : '결제가 완료됐어요'}
        </h1>
        <p className="mt-2 text-[12px] text-muted text-center leading-relaxed">
          {isWaitingDeposit
            ? '가상계좌가 발급되었어요. 안내된 계좌로 24시간 내에 입금해 주세요.'
            : '주문이 정상적으로 접수되었습니다'}
        </p>
      </section>

      <section className="px-5 mt-7">
        <div className="bg-white rounded-xl border border-rule px-5 py-5">
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-muted">주문번호</span>
            <span className="text-text font-bold font-mono">
              {order.order_number}
            </span>
          </div>
          <div className="border-t border-rule my-3" />
          <div className="flex justify-between items-center">
            <span
              className="font-bold"
              style={{ fontSize: 13, color: 'var(--ink)' }}
            >
              {isWaitingDeposit ? '입금 예정 금액' : '결제금액'}
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="font-serif"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--terracotta)',
                  letterSpacing: '-0.015em',
                }}
              >
                {order.total_amount.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted">원</span>
            </div>
          </div>
          {order.receipt_url && (
            <a
              href={order.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-bg text-[12px] font-bold text-terracotta hover:bg-rule transition"
            >
              <Receipt className="w-3.5 h-3.5" strokeWidth={2.25} />
              영수증 보기
            </a>
          )}
        </div>
      </section>

      {isWaitingDeposit ? (
        <section className="px-5 mt-4">
          <div className="bg-[#FFF6E0] rounded-xl border border-gold/50 px-4 py-4">
            <div className="text-[10px] text-muted font-bold uppercase tracking-widest">
              입금 안내
            </div>
            {order.virtual_account_number ? (
              <>
                <dl className="mt-2.5 space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">입금 은행</dt>
                    <dd className="text-text font-bold">
                      {bankCodeLabel(order.virtual_account_bank) || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted">계좌번호</dt>
                    <dd className="text-text font-mono font-bold text-[13px] break-all text-right">
                      {order.virtual_account_number}
                    </dd>
                  </div>
                  {order.virtual_account_holder && (
                    <div className="flex justify-between">
                      <dt className="text-muted">예금주</dt>
                      <dd className="text-text">
                        {order.virtual_account_holder}
                      </dd>
                    </div>
                  )}
                  {order.virtual_account_due_date && (
                    <div className="flex justify-between">
                      <dt className="text-muted">입금 기한</dt>
                      <dd className="text-sale font-bold">
                        {formatDueDate(order.virtual_account_due_date)}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="text-[11px] text-muted mt-3 leading-relaxed">
                  입금이 확인되면 상품 준비가 시작되고 알림을 보내드려요.
                  기한까지 입금되지 않으면 주문이 자동 취소됩니다.
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] text-text mt-1.5 leading-relaxed">
                  발급된 가상계좌 정보는 결제 직후 토스페이먼츠에서 보낸
                  안내(이메일/문자)에서 확인하실 수 있어요. 입금이 확인되면
                  상품 준비가 시작되고 알림을 보내드려요.
                </p>
                <p className="text-[11px] text-muted mt-2 leading-relaxed">
                  * 24시간 내 입금되지 않으면 주문이 자동 취소됩니다.
                </p>
              </>
            )}
          </div>
          {order.payment_method && (
            <p className="text-[10px] text-muted mt-2 text-center">
              결제 수단 · {paymentMethodLabel(order.payment_method)}
            </p>
          )}
        </section>
      ) : (
        <section className="px-5 mt-4">
          <div className="bg-bg rounded-xl border border-rule px-4 py-3">
            <div className="text-[10px] text-muted font-bold uppercase tracking-widest">
              배송 안내
            </div>
            <p className="text-[12px] text-text mt-1.5 leading-relaxed">
              주문하신 상품은 평일 기준 2~3일 내 출고됩니다.
            </p>
          </div>
        </section>
      )}

      <section className="px-5 mt-6 space-y-2">
        <Link
          href={`/mypage/orders/${order.id}`}
          className="block w-full text-center py-4 rounded-full text-[14px] font-bold active:scale-[0.98] transition"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            letterSpacing: '-0.01em',
            boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
          }}
        >
          주문 상세 보기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-full bg-white border border-rule text-[13px] font-bold text-muted active:scale-[0.98] transition"
        >
          쇼핑 계속하기
        </Link>
      </section>
    </main>
  )
}
