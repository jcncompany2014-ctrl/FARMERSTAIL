import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  카드: '카드',
  CARD: '카드',
  가상계좌: '가상계좌',
  계좌이체: '계좌이체',
  휴대폰: '휴대폰',
  상품권: '상품권',
  간편결제: '간편결제',
}

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

type Params = Promise<{ id: string }>

export default async function OrderDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/mypage/orders/${id}`)

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
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    notFound()
  }

  const items = Array.isArray(order.order_items) ? order.order_items : []

  // 주문 진행 단계 (payment_status가 paid인 경우만 의미 있음)
  const steps = [
    { key: 'preparing', label: '상품 준비' },
    { key: 'shipping', label: '배송 중' },
    { key: 'delivered', label: '배송 완료' },
  ]
  const currentStepIndex = steps.findIndex((s) => s.key === order.order_status)
  const isPaid = order.payment_status === 'paid'

  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/mypage/orders"
          className="text-xs text-[#8A7668] hover:text-[#A0452E]"
        >
          ← 주문 내역
        </Link>
        <h1 className="font-['Archivo_Black'] text-2xl text-[#2A2118] mt-2">
          ORDER DETAIL
        </h1>
        <p className="text-xs text-[#8A7668] mt-1 font-mono">
          {order.order_number}
        </p>
      </div>

      {/* 진행 상태 (결제 완료된 경우) */}
      {isPaid && order.order_status !== 'cancelled' && (
        <section className="mx-5 p-5 rounded-2xl bg-white border border-[#EDE6D8]">
          <h2 className="text-sm font-bold text-[#2A2118] mb-4">배송 상태</h2>
          <div className="flex items-center justify-between relative">
            {/* 배경 라인 */}
            <div className="absolute top-3 left-3 right-3 h-0.5 bg-[#EDE6D8]" />
            {/* 진행 라인 */}
            <div
              className="absolute top-3 left-3 h-0.5 bg-[#A0452E] transition-all"
              style={{
                width:
                  currentStepIndex >= 0
                    ? `calc(${(currentStepIndex / (steps.length - 1)) * 100}% - ${
                        currentStepIndex === steps.length - 1 ? '0px' : '0px'
                      })`
                    : '0%',
              }}
            />
            {steps.map((step, idx) => {
              const active = idx <= currentStepIndex
              return (
                <div
                  key={step.key}
                  className="relative flex flex-col items-center z-10"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      active
                        ? 'bg-[#A0452E] text-white'
                        : 'bg-[#EDE6D8] text-[#8A7668]'
                    }`}
                  >
                    {active ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-[10px] font-bold ${
                      active ? 'text-[#2A2118]' : 'text-[#8A7668]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 주문 상품 */}
      <section className="mx-5 mt-4 p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <h2 className="text-sm font-bold text-[#2A2118] mb-3">
          주문 상품 ({items.length})
        </h2>
        <ul className="space-y-3">
          {items.map((it: any) => (
            <li key={it.id} className="flex gap-3">
              <div className="shrink-0 w-14 h-14 rounded-lg bg-[#F5F0E6] overflow-hidden flex items-center justify-center">
                {it.product_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.product_image_url}
                    alt={it.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl">🐾</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2A2118] line-clamp-2">
                  {it.product_name}
                </p>
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
      <section className="mx-5 mt-4 p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <h2 className="text-sm font-bold text-[#2A2118] mb-3">배송지</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-16 shrink-0 text-[#8A7668]">받는 분</dt>
            <dd className="text-[#2A2118]">{order.recipient_name}</dd>
          </div>
          <div className="flex">
            <dt className="w-16 shrink-0 text-[#8A7668]">연락처</dt>
            <dd className="text-[#2A2118]">{order.recipient_phone}</dd>
          </div>
          <div className="flex">
            <dt className="w-16 shrink-0 text-[#8A7668]">주소</dt>
            <dd className="text-[#2A2118] flex-1">
              ({order.zip}) {order.address}
              {order.address_detail && ` ${order.address_detail}`}
            </dd>
          </div>
          {order.delivery_memo && (
            <div className="flex">
              <dt className="w-16 shrink-0 text-[#8A7668]">메모</dt>
              <dd className="text-[#2A2118]">{order.delivery_memo}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* 결제 정보 */}
      <section className="mx-5 mt-4 p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <h2 className="text-sm font-bold text-[#2A2118] mb-3">결제 정보</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#8A7668]">결제 상태</dt>
            <dd className="text-[#2A2118] font-medium">
              {PAYMENT_STATUS_LABEL[order.payment_status] ??
                order.payment_status}
            </dd>
          </div>
          {order.payment_method && (
            <div className="flex justify-between">
              <dt className="text-[#8A7668]">결제 수단</dt>
              <dd className="text-[#2A2118]">
                {PAYMENT_METHOD_LABEL[order.payment_method] ??
                  order.payment_method}
              </dd>
            </div>
          )}
          {order.paid_at && (
            <div className="flex justify-between">
              <dt className="text-[#8A7668]">결제 일시</dt>
              <dd className="text-[#2A2118]">{formatDateTime(order.paid_at)}</dd>
            </div>
          )}
        </dl>

        <div className="border-t border-[#EDE6D8] my-4" />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#8A7668]">상품 금액</dt>
            <dd className="text-[#2A2118]">
              {order.subtotal.toLocaleString()}원
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#8A7668]">배송비</dt>
            <dd className="text-[#2A2118]">
              {order.shipping_fee === 0
                ? '무료'
                : `${order.shipping_fee.toLocaleString()}원`}
            </dd>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#EDE6D8]">
            <dt className="text-[#2A2118] font-semibold">총 결제 금액</dt>
            <dd className="font-['Archivo_Black'] text-xl text-[#A0452E]">
              {order.total_amount.toLocaleString()}원
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}