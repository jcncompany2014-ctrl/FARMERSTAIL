import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

function statusColor(status: string) {
  switch (status) {
    case 'paid':
    case 'delivered':
      return 'bg-[#6B7F3A] text-white'
    case 'preparing':
    case 'shipping':
      return 'bg-[#A0452E] text-white'
    case 'pending':
      return 'bg-[#EDE6D8] text-[#5C4A3A]'
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return 'bg-[#B83A2E] text-white'
    default:
      return 'bg-[#EDE6D8] text-[#5C4A3A]'
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
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
      <div className="p-5">
        <p className="text-[#B83A2E]">주문 내역을 불러오지 못했어요.</p>
        <p className="text-xs text-[#8A7668] mt-2">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-['Archivo_Black'] text-2xl text-[#2A2118]">
          ORDERS
        </h1>
        <p className="text-sm text-[#8A7668] mt-1">
          총 {orders?.length ?? 0}건의 주문
        </p>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="px-5 mt-20 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-[#F5F0E6] flex items-center justify-center text-4xl">
            📦
          </div>
          <p className="mt-5 text-[#5C4A3A]">아직 주문 내역이 없어요</p>
          <Link
            href="/products"
            className="mt-6 px-6 py-3 rounded-full bg-[#A0452E] text-white text-sm font-medium"
          >
            제품 둘러보기
          </Link>
        </div>
      ) : (
        <ul className="px-5 space-y-3">
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
                  className="block p-4 rounded-2xl bg-white border border-[#EDE6D8] hover:border-[#A0452E] transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-[#8A7668]">
                      {formatDate(order.created_at)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(
                        displayStatus
                      )}`}
                    >
                      {label}
                    </span>
                  </div>

                  {firstItem && (
                    <div className="flex gap-3">
                      <div className="shrink-0 w-14 h-14 rounded-lg bg-[#F5F0E6] flex items-center justify-center overflow-hidden">
                        {firstItem.product_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={firstItem.product_image_url}
                            alt={firstItem.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl">🐾</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#2A2118] line-clamp-1">
                          {firstItem.product_name}
                          {extraCount > 0 && (
                            <span className="text-[#8A7668]">
                              {' '}
                              외 {extraCount}건
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#8A7668] mt-0.5">
                          {order.order_number}
                        </p>
                        <p className="font-['Archivo_Black'] text-[#A0452E] text-base mt-1">
                          {order.total_amount.toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}