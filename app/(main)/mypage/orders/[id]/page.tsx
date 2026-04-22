import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  Check,
  ShoppingBag,
  Star,
  AlertCircle,
  Truck,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ReorderButton from './ReorderButton'
import CancelOrderButton from './CancelOrderButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 상세',
  robots: { index: false, follow: false },
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  cancelled: '결제 취소',
  refunded: '전액 환불',
  partially_refunded: '부분 환불',
}

const CARRIER_LABEL: Record<string, string> = {
  cj: 'CJ대한통운',
  post: '우체국택배',
  lotte: '롯데택배',
  hanjin: '한진택배',
  logen: '로젠택배',
  kd: '경동택배',
  other: '기타',
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

  // Which items has this user already reviewed?
  const itemIds = items.map((it: { id: string }) => it.id)
  const { data: existingReviews } =
    itemIds.length > 0
      ? await supabase
          .from('reviews')
          .select('order_item_id')
          .eq('user_id', user.id)
          .in('order_item_id', itemIds)
      : { data: [] as { order_item_id: string }[] }
  const reviewedSet = new Set(
    (existingReviews ?? []).map((r) => r.order_item_id)
  )

  const steps = [
    { key: 'preparing', label: '상품 준비' },
    { key: 'shipping', label: '배송 중' },
    { key: 'delivered', label: '배송 완료' },
  ]
  const currentStepIndex = steps.findIndex((s) => s.key === order.order_status)
  const isPaid = order.payment_status === 'paid'
  const isCancelled = order.order_status === 'cancelled'
  const isCancellable =
    !isCancelled &&
    (order.order_status === 'pending' || order.order_status === 'preparing')

  return (
    <main className="pb-8">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage/orders"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 내역
        </Link>
        <span className="kicker mt-3 inline-block">Order Detail · 주문 상세</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          주문 상세
        </h1>
        <p className="text-[11px] text-muted mt-1 font-mono">
          {order.order_number}
        </p>
      </section>

      {/* 취소 안내 배너 */}
      {isCancelled && (
        <section className="px-5 mt-3">
          <div className="bg-sale/5 border border-sale/30 rounded-xl px-5 py-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="w-4 h-4 text-sale shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-sale">
                  취소된 주문
                </p>
                {order.cancelled_at && (
                  <p className="text-[11px] text-muted mt-1">
                    취소 일시 · {formatDateTime(order.cancelled_at)}
                  </p>
                )}
                {order.cancel_reason && (
                  <p className="text-[11px] text-text mt-1 leading-relaxed">
                    사유 · {order.cancel_reason}
                  </p>
                )}
                {isPaid && (
                  <p className="text-[10px] text-muted mt-2 leading-relaxed">
                    결제 금액은 3-5 영업일 내 환불, 사용한 포인트와 쿠폰은
                    환원되었어요.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 배송 타임라인 */}
      {isPaid && order.order_status !== 'cancelled' && (
        <section className="px-5 mt-3">
          <div className="bg-white rounded-xl border border-rule px-5 py-5">
            <h2 className="text-[13px] font-black text-text mb-4">
              배송 상태
            </h2>
            <div className="flex items-center justify-between relative">
              <div className="absolute top-3 left-3 right-3 h-0.5 bg-rule" />
              <div
                className="absolute top-3 left-3 h-0.5 bg-terracotta transition-all"
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
                          ? 'bg-terracotta text-white'
                          : 'bg-rule text-muted'
                      }`}
                    >
                      {active ? (
                        <Check className="w-3 h-3" strokeWidth={3} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] font-bold ${
                        active ? 'text-text' : 'text-muted'
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

      {/* 송장 / 배송 진행 정보 (발송된 이후에만) */}
      {isPaid &&
        !isCancelled &&
        (order.carrier ||
          order.tracking_number ||
          order.shipped_at ||
          order.delivered_at) && (
          <section className="px-5 mt-3">
            <div className="bg-white rounded-xl border border-rule px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck
                  className="w-4 h-4 text-moss"
                  strokeWidth={2}
                />
                <h2 className="text-[13px] font-black text-text">
                  운송장
                </h2>
              </div>
              <dl className="space-y-2 text-[12px]">
                {order.carrier && (
                  <div className="flex justify-between">
                    <dt className="text-muted">택배사</dt>
                    <dd className="text-text font-bold">
                      {CARRIER_LABEL[order.carrier] ?? order.carrier}
                    </dd>
                  </div>
                )}
                {order.tracking_number && (
                  <div className="flex justify-between items-center gap-2">
                    <dt className="text-muted">송장번호</dt>
                    <dd className="text-text font-mono text-[11px] break-all text-right">
                      {order.tracking_number}
                    </dd>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted">발송 일시</dt>
                    <dd className="text-text">
                      {formatDateTime(order.shipped_at)}
                    </dd>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted">도착 일시</dt>
                    <dd className="text-text font-bold">
                      {formatDateTime(order.delivered_at)}
                    </dd>
                  </div>
                )}
              </dl>
              {!order.tracking_number && order.order_status === 'shipping' && (
                <p className="mt-3 text-[10px] text-muted leading-relaxed">
                  송장번호가 곧 업데이트돼요.
                </p>
              )}
              {order.tracking_number && order.carrier && (
                <Link
                  href={`/mypage/orders/${order.id}/track`}
                  className="mt-4 flex items-center justify-between gap-2 px-3.5 py-3 rounded-lg bg-bg hover:bg-rule transition group"
                >
                  <span className="flex items-center gap-2">
                    <Truck
                      className="w-4 h-4 text-terracotta"
                      strokeWidth={2.25}
                    />
                    <span className="text-[12px] font-black text-text">
                      실시간 배송 조회
                    </span>
                  </span>
                  <ChevronRight
                    className="w-4 h-4 text-muted group-hover:text-terracotta group-hover:translate-x-0.5 transition"
                    strokeWidth={2.25}
                  />
                </Link>
              )}
            </div>
          </section>
        )}

      {/* 주문 상품 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-5 py-5">
          <h2 className="text-[13px] font-black text-text mb-3">
            주문 상품{' '}
            <span className="text-muted font-bold">({items.length})</span>
          </h2>
          <ul className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {items.map((it: any) => {
              const reviewed = reviewedSet.has(it.id)
              return (
                <li key={it.id}>
                  <div className="flex gap-3">
                    <div className="shrink-0 w-14 h-14 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
                      {it.product_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.product_image_url}
                          alt={it.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag
                          className="w-5 h-5 text-muted"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-text leading-snug line-clamp-2">
                        {it.product_name}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {it.unit_price.toLocaleString()}원 × {it.quantity}
                      </p>
                    </div>
                    <p className="text-[12px] font-black text-text whitespace-nowrap">
                      {it.line_total.toLocaleString()}원
                    </p>
                  </div>
                  {isPaid && (
                    <div className="mt-2 pl-[68px]">
                      {reviewed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-moss">
                          <Check className="w-3 h-3" strokeWidth={2.5} />
                          리뷰 작성 완료
                        </span>
                      ) : (
                        <Link
                          href={`/mypage/orders/${order.id}/review/${it.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rule text-[10px] font-bold text-terracotta hover:border-terracotta hover:bg-terracotta/5 transition"
                        >
                          <Star className="w-3 h-3" strokeWidth={2} />
                          리뷰 작성 · +500P
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* 배송지 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-5 py-5">
          <h2 className="text-[13px] font-black text-text mb-3">배송지</h2>
          <dl className="space-y-2 text-[12px]">
            <div className="flex">
              <dt className="w-16 shrink-0 text-muted">받는 분</dt>
              <dd className="text-text font-bold">
                {order.recipient_name}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-16 shrink-0 text-muted">연락처</dt>
              <dd className="text-text">{order.recipient_phone}</dd>
            </div>
            <div className="flex">
              <dt className="w-16 shrink-0 text-muted">주소</dt>
              <dd className="text-text flex-1 leading-relaxed">
                ({order.zip}) {order.address}
                {order.address_detail && ` ${order.address_detail}`}
              </dd>
            </div>
            {order.delivery_memo && (
              <div className="flex">
                <dt className="w-16 shrink-0 text-muted">메모</dt>
                <dd className="text-text">{order.delivery_memo}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 결제 정보 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-5 py-5">
          <h2 className="text-[13px] font-black text-text mb-3">
            결제 정보
          </h2>
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">결제 상태</dt>
              <dd className="text-text font-bold">
                {PAYMENT_STATUS_LABEL[order.payment_status] ??
                  order.payment_status}
              </dd>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <dt className="text-muted">결제 수단</dt>
                <dd className="text-text">
                  {PAYMENT_METHOD_LABEL[order.payment_method] ??
                    order.payment_method}
                </dd>
              </div>
            )}
            {order.paid_at && (
              <div className="flex justify-between">
                <dt className="text-muted">결제 일시</dt>
                <dd className="text-text">{formatDateTime(order.paid_at)}</dd>
              </div>
            )}
            {order.cash_receipt_type && (
              <div className="flex justify-between">
                <dt className="text-muted">현금영수증</dt>
                <dd className="text-text font-bold">
                  {order.cash_receipt_type}
                </dd>
              </div>
            )}
            {order.receipt_url && (
              <div className="flex justify-between items-center">
                <dt className="text-muted">영수증</dt>
                <dd>
                  <a
                    href={order.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terracotta font-bold hover:underline inline-flex items-center gap-1"
                  >
                    영수증 보기
                    <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <div className="border-t border-rule my-4" />

          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">상품 금액</dt>
              <dd className="text-text font-bold">
                {order.subtotal.toLocaleString()}원
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">배송비</dt>
              <dd className="text-text font-bold">
                {order.shipping_fee === 0
                  ? '무료'
                  : `${order.shipping_fee.toLocaleString()}원`}
              </dd>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-rule mt-2">
              <dt
                className="font-bold"
                style={{ fontSize: 13, color: 'var(--ink)' }}
              >
                총 결제 금액
              </dt>
              <dd className="flex items-baseline gap-1">
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
              </dd>
            </div>
            {(order.refunded_amount ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <dt className="text-[12px] text-muted">환불 금액</dt>
                <dd className="text-[13px] font-bold text-sale">
                  −{(order.refunded_amount ?? 0).toLocaleString()}원
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 재주문 CTA: 결제 완료 주문에만 노출 */}
      {isPaid && items.length > 0 && (
        <section className="px-5 mt-4">
          <ReorderButton
            items={items.map((it: { product_id: string; quantity: number }) => ({
              product_id: it.product_id,
              quantity: it.quantity,
            }))}
          />
          <p className="mt-2 text-[10px] text-muted text-center">
            장바구니에 동일 상품이 있으면 수량이 합쳐져요.
          </p>
        </section>
      )}

      {/* 주문 취소: 배송 시작 전에만 노출 */}
      {isCancellable && (
        <section className="px-5 mt-3">
          <CancelOrderButton orderId={order.id} />
        </section>
      )}
    </main>
  )
}
