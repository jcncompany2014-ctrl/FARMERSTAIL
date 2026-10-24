import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MessageCircle, ReceiptText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OrderStatusControl from './OrderStatusControl'
import ShippingControl from './ShippingControl'
import PartialCancelPanel from './PartialCancelPanel'
import PaymentEventTimeline from './PaymentEventTimeline'
import { Card, CardContent } from '@/components/adminui/card'
import { carrierLabel } from '@/lib/tracking'
import { customerHref } from '@/lib/admin/customer-link'
import { formatKstDateTime as formatDateTime, kstDateOf } from '@/lib/datetime-kst'
import {
  paymentStatusDisplay,
  type PaymentStatus,
} from '@/lib/commerce/order-fsm'
import { adminDiscountLabel } from '@/lib/commerce/discount-reason'
import { netPaidAmount } from '@/lib/commerce/paid-status'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { orderBadge } from '@/lib/admin/status-badge'
import { mdLabel } from '@/lib/admin/weekly-todo-core'

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

  // ★조회 실패와 '없는 주문'을 가른다 (2026-09-05 전수감사, AGENTS.md 규칙1).
  //   예전엔 error || !order → notFound() 라서 DB 장애가 404 로 위장됐다 —
  //   사장님이 "주문이 사라졌다"고 오판할 수 있는 화면이다. 실패는 에러
  //   바운더리로 던져 '조회 실패'로 보이게 한다. (.single() 은 0행도 error 를
  //   주므로 PGRST116 = 진짜 없음만 404 로.)
  if (error && error.code !== 'PGRST116') {
    console.error('[admin-order-detail] 주문 조회 실패:', error.message)
    throw new Error('주문 조회에 실패했어요 — 새로고침해 주세요.')
  }
  if (!order) {
    notFound()
  }

  // 주문자 profile 조회 (선택) — 실패 시 '-' 가 아니라 실패로 표시(규칙1).
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email, name, phone')
    .eq('id', order.user_id)
    .single()
  if (profileErr && profileErr.code !== 'PGRST116') {
    console.error('[admin-order-detail] 주문자 조회 실패:', profileErr.message)
  }
  const profileLoadFailed = Boolean(profileErr && profileErr.code !== 'PGRST116')

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
  // 정기배송 박스는 상품 줄에 원을 쓰지 않는다(2026-10-24 어드민 금액 말 정리) — 줄 단가가 팩 값을 반올림한 거라
  // 줄 합이 정가와 20~80원 어긋나, 한 화면에 숫자가 셋(줄 합·정가·결제한 금액)이 됐다. 가게 주문은 단가 × 개수가 진짜 값이라 그대로.
  const isSubscriptionOrder = Boolean(order.subscription_id)
  const paidAtIso: string | null = order.paid_at ?? null
  const refundedAmount: number = order.refunded_amount ?? 0
  const discountAmount: number = order.discount_amount ?? 0
  const pointsUsed: number = order.points_used ?? 0

  return (
    <div className="grid gap-4">
      {/* 헤더 — orders 목록과 같은 패턴 */}
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          주문 목록
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <ReceiptText className="size-5 text-primary" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            주문 상세
          </h1>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <AdminStatusBadge badge={orderBadge(order)} />
          <span className="font-mono text-[12px] text-muted-foreground">{order.order_number}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 왼쪽: 주문 정보 */}
        <div className="space-y-4 lg:col-span-2">
          {/* 주문 상품 */}
          <Panel title={`주문 상품 (${items.length})`}>
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                    {it.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.product_image_url}
                        alt={it.product_name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">🐾</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {isSubscriptionOrder
                        ? `${it.product_name} · ${it.quantity}일치`
                        : it.product_name}
                    </p>
                    {!isSubscriptionOrder && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {it.unit_price.toLocaleString()}원 × {it.quantity}
                      </p>
                    )}
                  </div>
                  {!isSubscriptionOrder && (
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
                      {it.line_total.toLocaleString()}원
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {/* 배송지 */}
          <Panel title="배송지">
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
          </Panel>

          {/* 결제 정보 — 2026-10-24 어드민 금액 말 정리: 맨 위에 카드에서 나간 돈(결제한 금액)을 크게, 그 아래 정가·할인 이름·배송비·환불을 작게.
              예전엔 할인 줄이 없어 정가 128,500원 아래 결제 78,500원이 떠서 더해도 맞지 않았다(DB 에는 할인과 이유가 있었다). 값은 전부 주문에 저장된 그대로다. */}
          <Panel title="결제 정보">
            {paidAtIso ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">결제한 금액</p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-2xl font-bold tracking-tight text-primary tabular-nums">
                    {order.total_amount.toLocaleString()}원
                  </span>
                  <span className="text-sm text-muted-foreground">
                    · {mdLabel(kstDateOf(paidAtIso))}
                  </span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-secondary px-3 py-2.5">
                <p className="text-lg font-bold">결제 안 됨</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  카드에서 나간 돈이 없어요 — 이 주문은 보내지 마세요.
                </p>
              </div>
            )}
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <InfoRow
                label="정가"
                value={`${order.subtotal.toLocaleString()}원`}
              />
              {discountAmount > 0 && (
                <InfoRow
                  label={adminDiscountLabel(order.discount_reason)}
                  value={`−${discountAmount.toLocaleString()}원`}
                />
              )}
              {/* 포인트는 없어진 제도(2026-07-16) — 옛 주문에 값이 남아 있을 때만 보여 합이 맞게 한다. */}
              {pointsUsed > 0 && (
                <InfoRow
                  label="포인트(없어진 제도)"
                  value={`−${pointsUsed.toLocaleString()}원`}
                />
              )}
              <InfoRow
                label="배송비"
                value={
                  order.shipping_fee === 0
                    ? '무료'
                    : `${order.shipping_fee.toLocaleString()}원`
                }
              />
              {refundedAmount > 0 && (
                <>
                  <InfoRow
                    label="환불한 금액"
                    value={
                      <span className="text-destructive">
                        −{refundedAmount.toLocaleString()}원
                      </span>
                    }
                  />
                  <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                    <dt className="font-semibold">남은 결제</dt>
                    <dd className="font-bold tabular-nums">
                      {netPaidAmount(order).toLocaleString()}원
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <div className="my-3 border-t border-border" />
            <dl className="space-y-2 text-sm">
              <InfoRow
                label="결제 상태"
                value={paymentStatusDisplay(
                  order.payment_status as PaymentStatus,
                  order.refunded_amount,
                )}
              />
              {order.payment_method && (
                <InfoRow label="결제 수단" value={order.payment_method} />
              )}
              {paidAtIso && (
                <InfoRow label="결제 시각" value={formatDateTime(paidAtIso)} />
              )}
            </dl>
            {/* 영어 칸(토스 키·고객 UUID)은 문의할 때만 필요해서 접어 둔다(2026-10-24 어드민 금액 말 정리). */}
            <details className="mt-3 rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                토스 결제번호·고객 번호(문의용)
              </summary>
              <dl className="mt-2 space-y-1.5 text-xs">
                {order.payment_key && (
                  <InfoRow
                    label="토스 결제번호"
                    value={
                      <span className="break-all font-mono text-xs">
                        {order.payment_key}
                      </span>
                    }
                  />
                )}
                <InfoRow
                  label="고객 번호"
                  value={
                    <span className="break-all font-mono text-xs">
                      {order.user_id}
                    </span>
                  }
                />
              </dl>
            </details>
          </Panel>
        </div>

        {/* 오른쪽: 관리 액션 */}
        <div className="space-y-4 lg:col-span-1">
          {/* 주문자 정보 */}
          <Panel title="주문자">
            {profileLoadFailed ? (
              <p className="text-xs text-destructive">
                주문자 정보를 불러오지 못했어요 — 새로고침해 주세요. (없는 게
                아니라 조회가 실패한 상태예요)
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <InfoRow
                  label="이름"
                  value={
                    <Link href={customerHref(order.user_id)} className="font-bold text-primary underline-offset-2 hover:underline">
                      {profile?.name ?? '(이름 없음)'} →
                    </Link>
                  }
                />
                <InfoRow
                  label="이메일"
                  value={
                    <span className="text-xs">{profile?.email ?? '-'}</span>
                  }
                />
                <InfoRow label="연락처" value={profile?.phone ?? '-'} />
                {/* 고객 번호(UUID)는 결제 정보의 '문의용' 접기 안으로 옮겼다(2026-10-24 어드민 금액 말 정리). */}
              </dl>
            )}
            {/* 동선 단축 — CS 문의·환불 안내를 바로 1:1 메시지로(구독 목록과
                같은 패턴, 2026-09-05 전수감사에서 이 화면에만 없던 것). */}
            <Link
              href={`/admin/users/${order.user_id}/message`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-ring hover:text-foreground"
            >
              <MessageCircle className="size-3.5" strokeWidth={2} />
              1:1 메시지 보내기
            </Link>
          </Panel>

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
            // 서포터즈 회차를 실제로 쓴 주문만 — 발송 여부에 따라 환불 뒤 회차가 돌아오는지가 다르다(규칙261).
            supporterBox={
              (order.discount_reason === 'trial_cheap' || order.discount_reason === 'trial_half') &&
              order.trial_round_consumed_at
                ? order.shipped_at
                  ? 'shipped'
                  : 'unshipped'
                : null
            }
          />

          {/* 현재 송장 (shipping 이후에만) */}
          {(order.carrier || order.tracking_number) && (
            <Panel title="운송장">
              <dl className="space-y-2 text-sm">
                {order.carrier && (
                  <InfoRow label="택배사" value={carrierLabel(order.carrier)} />
                )}
                {order.tracking_number && (
                  <InfoRow
                    label="송장번호"
                    value={
                      <span className="break-all font-mono text-xs">
                        {order.tracking_number}
                      </span>
                    }
                  />
                )}
                {order.shipped_at && (
                  <InfoRow
                    label="발송"
                    value={
                      <span className="text-xs">
                        {formatDateTime(order.shipped_at)}
                      </span>
                    }
                  />
                )}
                {order.delivered_at && (
                  <InfoRow
                    label="도착"
                    value={
                      <span className="text-xs">
                        {formatDateTime(order.delivered_at)}
                      </span>
                    }
                  />
                )}
              </dl>
            </Panel>
          )}

          {/* R63 — 결제 원장 시계열 (CS 도구) */}
          <PaymentEventTimeline orderId={id} />

          {/* 메타 정보 */}
          <Panel title="메타">
            <dl className="space-y-2 text-sm">
              <InfoRow
                label="생성"
                value={
                  <span className="text-xs">
                    {formatDateTime(order.created_at)}
                  </span>
                }
              />
              <InfoRow
                label="수정"
                value={
                  <span className="text-xs">
                    {formatDateTime(order.updated_at)}
                  </span>
                }
              />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** 섹션 카드 — adminui Card 얇은 래퍼(이 화면 전용). */
function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="px-4">
        <h2 className="mb-3 text-sm font-bold">{title}</h2>
        {children}
      </CardContent>
    </Card>
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
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  )
}
