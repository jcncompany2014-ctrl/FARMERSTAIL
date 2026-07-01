import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrderStatusControl from './OrderStatusControl'
import ShippingControl from './ShippingControl'
import PartialCancelPanel from './PartialCancelPanel'
import PaymentEventTimeline from './PaymentEventTimeline'
import { carrierLabel } from '@/lib/tracking'
import { formatKstDateTime as formatDateTime } from '@/lib/datetime-kst'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

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

  type AdminOrderItem = {
    id: string
    product_id: string
    product_name: string
    product_image_url: string | null
    unit_price: number
    quantity: number
    line_total: number
  }
  const items: AdminOrderItem[] = Array.isArray(order.order_items)
    ? (order.order_items as AdminOrderItem[])
    : []

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="text-xs text-muted hover:text-terracotta"
        >
          ← 주문 목록
        </Link>
        <h1 className="font-bold tracking-tight text-3xl text-ink mt-2">
          주문 상세
        </h1>
        <p className="text-xs text-muted mt-1 font-mono">
          {order.order_number}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 왼쪽: 주문 정보 */}
        <div className="col-span-2 space-y-4">
          {/* 주문 상품 */}
          <section className="p-6 rounded-2xl bg-white border border-rule">
            <h2 className="text-sm font-bold text-ink mb-4">
              주문 상품 ({items.length})
            </h2>
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex gap-3 items-center">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
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
                    <p className="text-sm text-ink">{it.product_name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {it.unit_price.toLocaleString()}원 × {it.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink whitespace-nowrap">
                    {it.line_total.toLocaleString()}원
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* 배송지 */}
          <section className="p-6 rounded-2xl bg-white border border-rule">
            <h2 className="text-sm font-bold text-ink mb-4">배송지</h2>
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
          <section className="p-6 rounded-2xl bg-white border border-rule">
            <h2 className="text-sm font-bold text-ink mb-4">결제 정보</h2>
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
              <div className="border-t border-rule my-3" />
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
              <div className="flex justify-between items-center pt-2 border-t border-rule">
                <dt className="text-ink font-semibold">총 결제 금액</dt>
                <dd className="font-bold tracking-tight text-xl text-terracotta">
                  {order.total_amount.toLocaleString()}원
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* 오른쪽: 관리 액션 */}
        <div className="col-span-1 space-y-4">
          {/* 주문자 정보 */}
          <section className="p-6 rounded-2xl bg-white border border-rule">
            <h2 className="text-sm font-bold text-ink mb-4">주문자</h2>
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

          {/* 발송 처리 (preparing → shipping) */}
          <ShippingControl
            orderId={order.id}
            currentOrderStatus={order.order_status}
            paymentStatus={order.payment_status}
            currentCarrier={order.carrier}
            currentTrackingNumber={order.tracking_number}
          />

          {/* R93 (D7): 부분/전액 환불 패널 — 이전엔 컴포넌트가 구현돼 있었으나
              page 에 렌더링 안 됨 (dead). 그 결과 운영자가 결제완료 주문을
              환불하려면 status route 로 cancelled 전이밖에 못 했고, 그 경로는
              Toss 환불/재고/포인트/쿠폰을 전부 누락했다. 이제 결제완료 주문의
              유일·정식 환불 경로로 연결. status route 는 결제완료 cancelled 를
              막으므로(REFUND_REQUIRED) 환불은 반드시 이 패널을 통한다. */}
          <PartialCancelPanel
            orderId={order.id}
            paymentMethod={order.payment_method ?? null}
            totalAmount={order.total_amount}
            refundedAmount={order.refunded_amount ?? 0}
            paymentStatus={order.payment_status}
          />

          {/* 현재 송장 (shipping 이후에만) */}
          {(order.carrier || order.tracking_number) && (
            <section className="p-6 rounded-2xl bg-white border border-rule">
              <h2 className="text-sm font-bold text-ink mb-4">운송장</h2>
              <dl className="space-y-2 text-sm">
                {order.carrier && (
                  <InfoRow
                    label="택배사"
                    value={carrierLabel(order.carrier)}
                  />
                )}
                {order.tracking_number && (
                  <InfoRow
                    label="송장번호"
                    value={
                      <span className="font-mono text-[11px] break-all">
                        {order.tracking_number}
                      </span>
                    }
                  />
                )}
                {order.shipped_at && (
                  <InfoRow
                    label="발송"
                    value={
                      <span className="text-[11px]">
                        {formatDateTime(order.shipped_at)}
                      </span>
                    }
                  />
                )}
                {order.delivered_at && (
                  <InfoRow
                    label="도착"
                    value={
                      <span className="text-[11px]">
                        {formatDateTime(order.delivered_at)}
                      </span>
                    }
                  />
                )}
              </dl>
            </section>
          )}

          {/* R63 — 결제 원장 시계열 (CS 도구) */}
          <PaymentEventTimeline orderId={id} />

          {/* 메타 정보 */}
          <section className="p-6 rounded-2xl bg-white border border-rule">
            <h2 className="text-sm font-bold text-ink mb-4">메타</h2>
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
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-ink text-right min-w-0">{value}</dd>
    </div>
  )
}