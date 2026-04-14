import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrderStatusControl from './OrderStatusControl'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params

  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      order_items (
        id,
        product_id,
        product_name,
        product_image_url,
        unit_price,
        quantity,
        line_total
      )
    `
    )
    .eq('id', id)
    .single()

  if (error || !order) {
    notFound()
  }

  // 주문자 profile 조회 (선택)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, name, phone')
    .eq('id', order.user_id)
    .single()

  const items = Array.isArray(order.order_items) ? order.order_items : []

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="text-xs text-[#8A7668] hover:text-[#A0452E]"
        >
          ← 주문 목록
        </Link>
        <h1 className="font-['Archivo_Black'] text-3xl text-[#2A2118] mt-2">
          ORDER DETAIL
        </h1>
        <p className="text-xs text-[#8A7668] mt-1 font-mono">
          {order.order_number}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 왼쪽: 주문 정보 */}
        <div className="col-span-2 space-y-4">
          {/* 주문 상품 */}
          <section className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
            <h2 className="text-sm font-bold text-[#2A2118] mb-4">
              주문 상품 ({items.length})
            </h2>
            <ul className="space-y-3">
              {items.map((it: any) => (
                <li key={it.id} className="flex gap-3 items-center">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-[#F5F0E6] overflow-hidden flex items-center justify-center">
                    {it.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.product_image_url}
                        alt={it.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">🐾</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#2A2118]">{it.product_name}</p>
                    <p className="text-xs text-[#8A7668] mt-0.5">
                      {it.unit_price.toLocaleString()}원 × {it.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#2A2118] whitespace-nowrap">
                    {it.line_total.toLocaleString()}원
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* 배송지 */}
          <section className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
            <h2 className="text-sm font-bold text-[#2A2118] mb-4">배송지</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="받는 분" value={order.recipient_name} />
              <InfoRow label="연락처" value={order.recipient_phone} />
              <InfoRow
                label="주소"
                value={`(${order.zip}) ${order.address}${
                  order.address_detail ? ` ${order.address_detail}` : ''
                }`}
              />
              {order.delivery_memo && (
                <InfoRow label="배송 메모" value={order.delivery_memo} />
              )}
            </dl>
          </section>

          {/* 결제 정보 */}
          <section className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
            <h2 className="text-sm font-bold text-[#2A2118] mb-4">결제 정보</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="결제 상태" value={order.payment_status} />
              {order.payment_method && (
                <InfoRow label="결제 수단" value={order.payment_method} />
              )}
              {order.paid_at && (
                <InfoRow label="결제 일시" value={formatDateTime(order.paid_at)} />
              )}
              {order.payment_key && (
                <InfoRow
                  label="Payment Key"
                  value={
                    <span className="font-mono text-[10px] break-all">
                      {order.payment_key}
                    </span>
                  }
                />
              )}
              <div className="border-t border-[#EDE6D8] my-3" />
              <InfoRow
                label="상품 금액"
                value={`${order.subtotal.toLocaleString()}원`}
              />
              <InfoRow
                label="배송비"
                value={
                  order.shipping_fee === 0
                    ? '무료'
                    : `${order.shipping_fee.toLocaleString()}원`
                }
              />
              <div className="flex justify-between items-center pt-2 border-t border-[#EDE6D8]">
                <dt className="text-[#2A2118] font-semibold">총 결제 금액</dt>
                <dd className="font-['Archivo_Black'] text-xl text-[#A0452E]">
                  {order.total_amount.toLocaleString()}원
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* 오른쪽: 관리 액션 */}
        <div className="col-span-1 space-y-4">
          {/* 주문자 정보 */}
          <section className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
            <h2 className="text-sm font-bold text-[#2A2118] mb-4">주문자</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="이름" value={profile?.name ?? '-'} />
              <InfoRow
                label="이메일"
                value={<span className="text-[11px]">{profile?.email ?? '-'}</span>}
              />
              <InfoRow label="연락처" value={profile?.phone ?? '-'} />
              <InfoRow
                label="User ID"
                value={
                  <span className="font-mono text-[9px] break-all">
                    {order.user_id}
                  </span>
                }
              />
            </dl>
          </section>

          {/* 상태 관리 */}
          <OrderStatusControl
            orderId={order.id}
            currentOrderStatus={order.order_status}
            paymentStatus={order.payment_status}
          />

          {/* 메타 정보 */}
          <section className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
            <h2 className="text-sm font-bold text-[#2A2118] mb-4">메타</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow
                label="생성"
                value={
                  <span className="text-[11px]">
                    {formatDateTime(order.created_at)}
                  </span>
                }
              />
              <InfoRow
                label="수정"
                value={
                  <span className="text-[11px]">
                    {formatDateTime(order.updated_at)}
                  </span>
                }
              />
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#8A7668] shrink-0">{label}</dt>
      <dd className="text-[#2A2118] text-right min-w-0">{value}</dd>
    </div>
  )
}