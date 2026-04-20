import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Params = Promise<{ id: string }>

export default async function OrderDetailPage({ params }: { params: Params }) {
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

  const steps = [
    { key: 'preparing', label: '상품 준비' },
    { key: 'shipping', label: '배송 중' },
    { key: 'delivered', label: '배송 완료' },
  ]
  const currentStepIndex = steps.findIndex((s) => s.key === order.order_status)
  const isPaid = order.payment_status === 'paid'

  return (
    <main className="pb-8">
      {/* 헤더 */}
      <section className="px-5 pt-5 pb-1">
        <Link
          href="/mypage/orders"
          className="text-[11px] text-[#8A7668] hover:text-[#A0452E] inline-flex items-center gap-1"
        >
          ← 주문 내역
        </Link>
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight mt-1">
          주문 상세
        </h1>
        <p className="text-[11px] text-[#8A7668] mt-0.5 font-mono">
          {order.order_number}
        </p>
      </section>

      {/* 배송 타임라인 */}
      {isPaid && order.order_status !== 'cancelled' && (
        <section className="px-5 mt-3">
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
            <h2 className="text-[13px] font-black text-[#3D2B1F] mb-4">
              배송 상태
            </h2>
            <div className="flex items-center justify-between relative">
              <div className="absolute top-3 left-3 right-3 h-0.5 bg-[#EDE6D8]" />
              <div
                className="absolute top-3 left-3 h-0.5 bg-[#A0452E] transition-all"
                style={{
                  width:
                    currentStepIndex >= 0
                      ? `${(currentStepIndex / (steps.length - 1)) * 100}%`
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        active
                          ? 'bg-[#A0452E] text-white'
                          : 'bg-[#EDE6D8] text-[#8A7668]'
                      }`}
                    >
                      {active ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] font-bold ${
                        active ? 'text-[#3D2B1F]' : 'text-[#8A7668]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 주문 상품 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <h2 className="text-[13px] font-black text-[#3D2B1F] mb-3">
            주문 상품{' '}
            <span className="text-[#8A7668] font-bold">({items.length})</span>
          </h2>
          <ul className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                  <p className="text-[12px] font-bold text-[#3D2B1F] leading-snug line-clamp-2">
                    {it.product_name}
                  </p>
                  <p className="text-[10px] text-[#8A7668] mt-0.5">
                    {it.unit_price.toLocaleString()}원 × {it.quantity}
                  </p>
                </div>
                <p className="text-[12px] font-black text-[#3D2B1F] whitespace-nowrap">
                  {it.line_total.toLocaleString()}원
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 배송지 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <h2 className="text-[13px] font-black text-[#3D2B1F] mb-3">배송지</h2>
          <dl className="space-y-2 text-[12px]">
            <div className="flex">
              <dt className="w-16 shrink-0 text-[#8A7668]">받는 분</dt>
              <dd className="text-[#3D2B1F] font-bold">
                {order.recipient_name}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-16 shrink-0 text-[#8A7668]">연락처</dt>
              <dd className="text-[#3D2B1F]">{order.recipient_phone}</dd>
            </div>
            <div className="flex">
              <dt className="w-16 shrink-0 text-[#8A7668]">주소</dt>
              <dd className="text-[#3D2B1F] flex-1 leading-relaxed">
                ({order.zip}) {order.address}
                {order.address_detail && ` ${order.address_detail}`}
              </dd>
            </div>
            {order.delivery_memo && (
              <div className="flex">
                <dt className="w-16 shrink-0 text-[#8A7668]">메모</dt>
                <dd className="text-[#3D2B1F]">{order.delivery_memo}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 결제 정보 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <h2 className="text-[13px] font-black text-[#3D2B1F] mb-3">
            결제 정보
          </h2>
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-[#8A7668]">결제 상태</dt>
              <dd className="text-[#3D2B1F] font-bold">
                {PAYMENT_STATUS_LABEL[order.payment_status] ??
                  order.payment_status}
              </dd>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <dt className="text-[#8A7668]">결제 수단</dt>
                <dd className="text-[#3D2B1F]">
                  {PAYMENT_METHOD_LABEL[order.payment_method] ??
                    order.payment_method}
                </dd>
              </div>
            )}
            {order.paid_at && (
              <div className="flex justify-between">
                <dt className="text-[#8A7668]">결제 일시</dt>
                <dd className="text-[#3D2B1F]">{formatDateTime(order.paid_at)}</dd>
              </div>
            )}
          </dl>

          <div className="border-t border-[#EDE6D8] my-4" />

          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-[#8A7668]">상품 금액</dt>
              <dd className="text-[#3D2B1F] font-bold">
                {order.subtotal.toLocaleString()}원
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#8A7668]">배송비</dt>
              <dd className="text-[#3D2B1F] font-bold">
                {order.shipping_fee === 0
                  ? '무료'
                  : `${order.shipping_fee.toLocaleString()}원`}
              </dd>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#EDE6D8] mt-2">
              <dt className="text-[13px] font-black text-[#3D2B1F]">
                총 결제 금액
              </dt>
              <dd className="flex items-baseline gap-1">
                <span className="text-[18px] font-black text-[#A0452E]">
                  {order.total_amount.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#8A7668]">원</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  )
}
