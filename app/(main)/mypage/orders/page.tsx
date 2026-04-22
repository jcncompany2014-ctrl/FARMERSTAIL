import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Package, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 내역',
  description: '내 주문 내역',
  robots: { index: false, follow: false },
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  preparing: '상품 준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '취소됨',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  cancelled: '결제 취소',
  refunded: '환불',
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
    case 'delivered':
      return 'bg-moss text-white'
    case 'preparing':
    case 'shipping':
      return 'bg-terracotta text-white'
    case 'pending':
      return 'bg-gold text-text'
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return 'bg-sale text-white'
    default:
      return 'bg-rule text-text'
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/mypage/orders')

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      total_amount,
      payment_status,
      order_status,
      created_at,
      order_items (
        id,
        product_name,
        product_image_url,
        quantity,
        unit_price
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="pb-8">
        <div className="px-5 pt-5">
          <div className="bg-white rounded-xl border border-rule px-5 py-5">
            <p className="text-[13px] font-bold text-sale">
              주문 내역을 불러오지 못했어요
            </p>
            <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pb-8">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 inline-block">Orders · 주문 내역</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          주문 내역
        </h1>
        <p className="text-[11px] text-muted mt-1">
          총 {orders?.length ?? 0}건의 주문
        </p>
      </section>

      {!orders || orders.length === 0 ? (
        <section className="px-5 mt-14">
          <div
            className="rounded-2xl border px-5 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Package
                className="w-6 h-6 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker mt-4 inline-block">Empty · 내역 없음</span>
            <p
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              아직 주문 내역이 없어요
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              첫 주문을 시작해 보세요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              제품 둘러보기
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-5 mt-3">
          <ul className="space-y-2.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {orders.map((order: any) => {
              const items = Array.isArray(order.order_items)
                ? order.order_items
                : []
              const firstItem = items[0]
              const extraCount = items.length - 1

              const displayStatus =
                order.payment_status === 'paid'
                  ? order.order_status
                  : order.payment_status
              const label =
                order.payment_status === 'paid'
                  ? ORDER_STATUS_LABEL[order.order_status] ??
                    order.order_status
                  : PAYMENT_STATUS_LABEL[order.payment_status] ??
                    order.payment_status

              return (
                <li key={order.id}>
                  <Link
                    href={`/mypage/orders/${order.id}`}
                    className="block bg-white rounded-xl border border-rule px-4 py-4 hover:border-text transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] text-muted font-bold">
                        {formatDate(order.created_at)}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${statusBadge(
                          displayStatus
                        )}`}
                      >
                        {label}
                      </span>
                    </div>

                    {firstItem && (
                      <div className="flex gap-3">
                        <div className="shrink-0 w-14 h-14 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
                          {firstItem.product_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={firstItem.product_image_url}
                              alt={firstItem.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingBag
                              className="w-6 h-6 text-muted"
                              strokeWidth={1.5}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-text line-clamp-1">
                            {firstItem.product_name}
                            {extraCount > 0 && (
                              <span className="text-muted">
                                {' '}외 {extraCount}건
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5 font-mono">
                            {order.order_number}
                          </p>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span
                              className="font-serif"
                              style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color: 'var(--terracotta)',
                                letterSpacing: '-0.015em',
                              }}
                            >
                              {order.total_amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted">
                              원
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
