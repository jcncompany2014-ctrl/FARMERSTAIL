import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  status?: string
  q?: string
}>

function formatDate(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}

function statusBadge(paymentStatus: string, orderStatus: string) {
  if (paymentStatus !== 'paid') {
    const labelMap: Record<string, string> = {
      pending: '결제 대기',
      failed: '결제 실패',
      cancelled: '결제 취소',
      refunded: '환불',
    }
    return {
      label: labelMap[paymentStatus] ?? paymentStatus,
      color: 'bg-rule text-text',
    }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', color: 'bg-terracotta text-white' }
    case 'shipping':
      return { label: '배송 중', color: 'bg-moss text-white' }
    case 'delivered':
      return { label: '배송 완료', color: 'bg-[#8BA05A] text-white' }
    case 'cancelled':
      return { label: '취소', color: 'bg-sale text-white' }
    default:
      return { label: orderStatus, color: 'bg-rule text-text' }
  }
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '결제 전' },
  { key: 'preparing', label: '준비 중' },
  { key: 'shipping', label: '배송 중' },
  { key: 'delivered', label: '배송 완료' },
  { key: 'cancelled', label: '취소' },
]

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { status = 'all', q = '' } = await searchParams

  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, payment_status, order_status, created_at, recipient_name, recipient_phone'
    )
    .order('created_at', { ascending: false })
    .limit(100)

  // 상태 필터
  if (status === 'pending') {
    query = query.eq('payment_status', 'pending')
  } else if (
    status === 'preparing' ||
    status === 'shipping' ||
    status === 'delivered' ||
    status === 'cancelled'
  ) {
    query = query.eq('payment_status', 'paid').eq('order_status', status)
  }

  // 검색 (주문번호 or 수령자명)
  if (q.trim()) {
    query = query.or(
      `order_number.ilike.%${q.trim()}%,recipient_name.ilike.%${q.trim()}%`
    )
  }

  const { data: orders, error } = await query

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Archivo_Black'] text-3xl text-ink">
          ORDERS
        </h1>
        <p className="text-sm text-muted mt-1">주문 관리</p>
      </div>

      {/* 필터 탭 + 검색 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const active = status === f.key
            const href =
              f.key === 'all'
                ? `/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/admin/orders?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            return (
              <Link
                key={f.key}
                href={href}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  active
                    ? 'bg-[#2A2118] text-white'
                    : 'bg-white text-text border border-rule hover:border-terracotta'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        <form
          action="/admin/orders"
          method="get"
          className="flex gap-2 items-center"
        >
          {status !== 'all' && (
            <input type="hidden" name="status" value={status} />
          )}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="주문번호 또는 이름"
            className="px-3 py-1.5 rounded-full text-xs bg-white border border-rule focus:outline-none focus:border-terracotta w-52"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-terracotta text-white hover:bg-[#8A3822] transition"
          >
            검색
          </button>
        </form>
      </div>

      {/* 주문 테이블 */}
      <div className="p-6 rounded-2xl bg-white border border-rule">
        {error ? (
          <p className="text-sale text-sm">에러: {error.message}</p>
        ) : !orders || orders.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            조건에 맞는 주문이 없어요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-rule">
                  <th className="text-left py-2 font-medium">주문번호</th>
                  <th className="text-left py-2 font-medium">주문자</th>
                  <th className="text-left py-2 font-medium">연락처</th>
                  <th className="text-right py-2 font-medium">금액</th>
                  <th className="text-center py-2 font-medium">상태</th>
                  <th className="text-right py-2 font-medium">주문 시각</th>
                  <th className="text-center py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = statusBadge(o.payment_status, o.order_status)
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-bg hover:bg-bg transition"
                    >
                      <td className="py-3 font-mono text-[11px] text-ink">
                        {o.order_number}
                      </td>
                      <td className="py-3 text-ink">{o.recipient_name}</td>
                      <td className="py-3 text-[11px] text-text">
                        {o.recipient_phone}
                      </td>
                      <td className="py-3 text-right font-semibold text-ink">
                        {o.total_amount.toLocaleString()}원
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-[11px] text-terracotta hover:underline font-semibold"
                        >
                          상세 →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}