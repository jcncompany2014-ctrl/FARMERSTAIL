import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import {
  Check,
  ShoppingBag,
  AlertCircle,
  Truck,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import CopyButton from '@/components/ui/CopyButton'
import CancelOrderButton from './CancelOrderButton'
import {
  bankCodeLabel,
  formatDueDate,
  paymentMethodLabel,
} from '@/lib/payments/toss'
import { carrierLabel } from '@/lib/tracking'
import { selfCancelBlockedByConsent } from '@/lib/payments/no-cancel-consent'
import { discountReasonLabel } from '@/lib/commerce/discount-reason'
import { isAppContextServer } from '@/lib/app-context'
import { paidBoxShipIso, weekdayKo } from '@/lib/shipping-schedule'
import { kstDateOf, formatKstKoDateTime } from '@/lib/datetime-kst'
import OrderDetailAppView, { type OrderDetailAppModel } from './OrderDetailAppView'

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

// 택배사/결제수단 라벨은 각각 lib/tracking, lib/payments/toss 로 일원화.

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // 서버 컴포넌트는 기본 UTC — 결제/배송 일시를 KST 로 고정 (영수증 페이지와 정합).
    timeZone: 'Asia/Seoul',
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

  type OrderItemRow = {
    id: string
    product_id: string
    product_name: string
    product_image_url: string | null
    unit_price: number
    quantity: number
    line_total: number
  }
  const items: OrderItemRow[] = Array.isArray(order.order_items)
    ? (order.order_items as OrderItemRow[])
    : []

  const steps = [
    { key: 'preparing', label: '상품 준비' },
    { key: 'shipping', label: '배송 중' },
    { key: 'delivered', label: '배송 완료' },
  ]
  const currentStepIndex = steps.findIndex((s) => s.key === order.order_status)
  const isPaid = order.payment_status === 'paid'
  const isCancelled = order.order_status === 'cancelled'
  // ★결제 상태가 이미 종결(환불·부분환불·취소)이면 셀프취소 버튼을 숨긴다
  //   (2026-08-20 6라운드 감사). 어드민이 미발송 주문을 전액환불하면
  //   payment_status='refunded' 인데 order_status 는 'preparing' 그대로라(이력
  //   보존), 예전엔 취소 버튼이 남아 고객이 누르면 refunded_amount 가 0으로
  //   덮여 실제 환불 기록이 사라졌다. order_status 만 보던 판정에 결제 종결을 더한다.
  const paymentSettled =
    order.payment_status === 'refunded' ||
    order.payment_status === 'partially_refunded' ||
    order.payment_status === 'cancelled'
  // ★결제된 정기배송 박스는 셀프 취소가 없다(2026-10-01 — 결제 = 조리 시작). 서버(cancel 라우트)도 막는다.
  //   단 **그 결제 전에 '결제 후 취소 안내'에 동의한 박스만**(2026-10-02 A안 — 판정 정본 lib/payments/no-cancel-consent).
  //   동의 기록이 없으면 게시된 환불정책대로 취소 버튼을 둔다. 조회 실패면 버튼을 두고 서버가 판정한다.
  const orderSubId = (order as { subscription_id?: string | null }).subscription_id ?? null
  let noCancelConsentAt: string | null = null
  // 그 정기배송의 다음 발송일 — 앱 화면이 결제된 이번 박스의 '발송 예정'을 정본(paidBoxShipIso)으로 말할 때만 쓴다(표시용).
  let subNextDelivery: string | null = null
  if (orderSubId && order.payment_status === 'paid' && order.order_status === 'preparing') {
    const { data: consentRow, error: consentErr } = await supabase
      .from('subscriptions')
      .select('no_cancel_consent_at, next_delivery_date')
      .eq('id', orderSubId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (consentErr) console.error('[mypage/orders] 취소 안내 동의 조회 실패:', consentErr.message)
    noCancelConsentAt = consentRow?.no_cancel_consent_at ?? null
    subNextDelivery = (consentRow as { next_delivery_date?: string | null } | null)?.next_delivery_date ?? null
  }
  const isPaidSubscriptionBox =
    !!orderSubId &&
    order.payment_status === 'paid' &&
    order.order_status === 'preparing' &&
    selfCancelBlockedByConsent({ consentAt: noCancelConsentAt, paidAt: order.paid_at ?? order.created_at })
  // 정기배송 결제 진행 중(결제 대기)·이미 발송된 주문은 셀프 취소 대상이 아니다 — 취소 API 와 같은 조건(10차 점검 C).
  const subscriptionChargeInFlight = !!orderSubId && order.payment_status === 'pending'
  const alreadyShipped = !!(order as { shipped_at?: string | null }).shipped_at
  const isCancellable =
    !isCancelled &&
    !paymentSettled &&
    !isPaidSubscriptionBox &&
    !subscriptionChargeInFlight &&
    !alreadyShipped &&
    (order.order_status === 'pending' || order.order_status === 'preparing')

  // ── 앱 화면(앱 새 디자인 'A 포스터', 2026-10-09 캔버스 M08·I01) — 위 판정을 그대로 넘기고 그리기만 다르다. ──
  if (await isAppContextServer()) {
    const showTracking =
      isPaid && !isCancelled && !!(order.carrier || order.tracking_number || order.shipped_at || order.delivered_at)
    // 날짜는 formatKstKoDateTime — 아래 웹의 formatDateTime(toLocaleString)은 서버 ICU 에서 "AM 07:00" 이 된다(2026-10-09 실측).
    const shipRows: OrderDetailAppModel['shipRows'] = []
    if (showTracking) {
      if (order.carrier) shipRows.push({ label: '택배사', value: carrierLabel(order.carrier), strong: true })
      if (order.tracking_number) shipRows.push({ label: '송장번호', value: order.tracking_number, spaced: true })
      if (order.shipped_at) shipRows.push({ label: '발송 일시', value: formatKstKoDateTime(order.shipped_at) })
      if (order.delivered_at) shipRows.push({ label: '도착 일시', value: formatKstKoDateTime(order.delivered_at), strong: true })
    } else if (isPaid && !isCancelled && orderSubId && order.order_status === 'preparing') {
      // 결제됐고 아직 안 나간 정기배송 박스(시안 I01) — 결제한 날과 발송 예정일(정본 paidBoxShipIso — 정기배송 화면과 같은 판정).
      const paidAtIso = order.paid_at ?? order.created_at
      const paidDay = kstDateOf(paidAtIso)
      const shipIso = paidBoxShipIso(subNextDelivery, paidAtIso)
      const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
      shipRows.push({ label: '결제', value: `${md(paidDay)} 결제 완료`, strong: true })
      shipRows.push({ label: '발송 예정', value: md(shipIso), strong: true })
    }
    const model: OrderDetailAppModel = {
      id: order.id,
      orderNumber: order.order_number,
      showReceipt: ['paid', 'partially_refunded', 'refunded'].includes(order.payment_status),
      isCancelled,
      cancelledAtText: order.cancelled_at ? formatKstKoDateTime(order.cancelled_at) : null,
      cancelReason: order.cancel_reason ?? null,
      refundNote: isCancelled && isPaid,
      stepIndex: isPaid && !isCancelled ? currentStepIndex : null,
      shipRows,
      trackHref: showTracking && order.tracking_number && order.carrier ? `/mypage/orders/${order.id}/track` : null,
      trackingSoon: showTracking && !order.tracking_number && order.order_status === 'shipping',
      items,
      virtualAccount:
        order.payment_status === 'pending' && order.virtual_account_number
          ? {
              bank: bankCodeLabel(order.virtual_account_bank) || '—',
              number: order.virtual_account_number,
              holder: order.virtual_account_holder ?? null,
              due: order.virtual_account_due_date ? formatDueDate(order.virtual_account_due_date) : null,
              amount: order.total_amount,
            }
          : null,
      recipient: {
        name: order.recipient_name,
        phone: order.recipient_phone,
        address: `(${order.zip}) ${order.address}${order.address_detail ? `\n${order.address_detail}` : ''}`,
        memo: order.delivery_memo ?? null,
      },
      payRows: [
        { label: '결제 상태', value: PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status, strong: true },
        ...(order.payment_method ? [{ label: '결제 수단', value: paymentMethodLabel(order.payment_method) }] : []),
        ...(order.paid_at ? [{ label: '결제 일시', value: formatKstKoDateTime(order.paid_at) }] : []),
        ...(order.cash_receipt_type ? [{ label: '현금영수증', value: order.cash_receipt_type, strong: true }] : []),
        ...(order.receipt_url
          ? [
              {
                label: '카드 영수증',
                value: (
                  <a
                    href={order.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 800, color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    영수증 보기 ›
                  </a>
                ),
              },
            ]
          : []),
      ],
      subtotal: order.subtotal,
      shippingFeeText: order.shipping_fee === 0 ? '무료' : `${order.shipping_fee.toLocaleString('ko-KR')}원`,
      discount:
        (order.discount_amount ?? 0) > 0
          ? { label: discountReasonLabel(order.discount_reason), amount: order.discount_amount ?? 0 }
          : null,
      total: order.total_amount,
      refunded: order.refunded_amount ?? 0,
      cancelSlot: isCancellable ? <CancelOrderButton orderId={order.id} /> : null,
      paidSubscriptionBox: isPaidSubscriptionBox,
    }
    return (
      <AuthAwareShell>
        <OrderDetailAppView m={model} />
      </AuthAwareShell>
    )
  }

  return (
    <AuthAwareShell>
    <main className="pb-8 mx-auto" style={{ maxWidth: 1024 }}>
      {/* 헤더 */}
      <section className="px-5 pt-6 md:pt-8 pb-2 md:pb-3 md:px-6">
        <Link
          href="/mypage/orders"
          className="ft-app-back-hide text-[11px] md:text-[12.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 내역
        </Link>
        <span className="kicker mt-3 block">Order Detail</span>
        <h1
          className="font-serif mt-1.5 md:mt-3 text-[22px] md:text-[34px] lg:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          주문 상세
        </h1>
        <p className="text-[11px] md:text-[13px] text-muted mt-1 md:mt-2 font-mono">
          {order.order_number}
        </p>

        {/* 인쇄 / PDF 영수증 — 본문 외 새 탭으로 print-optimized 페이지 열기.
            사업자 정보 + 주문/배송지/결제 합계가 한 장에 정리돼 세무 / 보관용. */}
        {/* 결제된 주문만 영수증 링크(2026-09-28) — 결제 실패·대기 주문의 영수증 화면은 막았다. */}
        {['paid', 'partially_refunded', 'refunded'].includes(order.payment_status) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/mypage/orders/${order.id}/receipt`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-rule text-text hover:border-text transition"
          >
            영수증 / PDF
          </Link>
        </div>
        )}
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
                    결제 금액은 3~7 영업일 내에 원 결제 수단으로 환불돼요.
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
              {/* UI audit #4: 운송장 dt 라벨 column w-20 통일 — 결제 정보 dl 과 동일. */}
              <dl className="space-y-2 text-[12px]">
                {order.carrier && (
                  <div className="flex justify-between">
                    <dt className="text-muted w-20 shrink-0">택배사</dt>
                    <dd className="text-text font-bold text-right">
                      {carrierLabel(order.carrier)}
                    </dd>
                  </div>
                )}
                {order.tracking_number && (
                  <div className="flex justify-between items-center gap-2">
                    <dt className="text-muted w-20 shrink-0">송장번호</dt>
                    <dd className="text-text font-mono text-[11px] break-all text-right">
                      {order.tracking_number}
                    </dd>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted w-20 shrink-0">발송 일시</dt>
                    <dd className="text-text text-right tabular-nums">
                      {formatDateTime(order.shipped_at)}
                    </dd>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted w-20 shrink-0">도착 일시</dt>
                    <dd className="text-text font-bold text-right tabular-nums">
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
            {items.map((it) => (
                <li key={it.id}>
                  <div className="flex gap-3">
                    <div className="relative shrink-0 w-14 h-14 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
                      {it.product_image_url ? (
                        <Image
                          src={it.product_image_url}
                          alt={it.product_name}
                          fill
                          sizes="56px"
                          className="object-cover"
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
                      <p className="text-[10px] text-muted mt-0.5 tabular-nums">
                        {it.unit_price.toLocaleString()}원 × {it.quantity}
                      </p>
                    </div>
                    <p className="text-[12px] font-black text-text whitespace-nowrap tabular-nums">
                      {it.line_total.toLocaleString()}원
                    </p>
                  </div>
                </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 가상계좌 입금 안내 — payment_status === 'pending' && VA 필드가 있을 때만 */}
      {order.payment_status === 'pending' &&
        order.virtual_account_number && (
          <section className="px-5 mt-3">
            <div className="bg-[#FFF6E0] rounded-xl border border-gold/50 px-5 py-5">
              <div className="text-[10px] text-muted font-bold uppercase tracking-widest mb-2">
                입금 대기 · 가상계좌
              </div>
              <dl className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-muted">입금 은행</dt>
                  <dd className="text-text font-bold">
                    {bankCodeLabel(order.virtual_account_bank) || '—'}
                  </dd>
                </div>
                {/* UX audit #4: 계좌번호 옆 복사 버튼 — 길게 눌러 선택 X. */}
                <div className="flex justify-between items-center gap-2">
                  <dt className="text-muted shrink-0">계좌번호</dt>
                  <dd className="text-text font-mono font-bold text-[13px] break-all text-right flex-1 min-w-0">
                    {order.virtual_account_number}
                  </dd>
                  <CopyButton
                    text={order.virtual_account_number}
                    label="복사"
                    size="xs"
                  />
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
                <div className="flex justify-between border-t border-gold/30 pt-2 mt-2">
                  <dt className="text-text font-bold">입금 금액</dt>
                  <dd className="text-terracotta font-black tabular-nums">
                    {order.total_amount.toLocaleString()}원
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                기한까지 입금되지 않으면 주문이 자동 취소돼요.
              </p>
            </div>
          </section>
        )}

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
          {/* UI audit #4: dt 라벨 column width 통일 (w-20) — 결제 상태 / 결제 수단 /
              결제 일시 / 현금영수증 / 영수증 라벨 끝 위치 row 마다 일직선. */}
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted w-20 shrink-0">결제 상태</dt>
              <dd className="text-text font-bold text-right">
                {PAYMENT_STATUS_LABEL[order.payment_status] ??
                  order.payment_status}
              </dd>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <dt className="text-muted w-20 shrink-0">결제 수단</dt>
                <dd className="text-text text-right">
                  {paymentMethodLabel(order.payment_method)}
                </dd>
              </div>
            )}
            {order.paid_at && (
              <div className="flex justify-between">
                <dt className="text-muted w-20 shrink-0">결제 일시</dt>
                <dd className="text-text text-right tabular-nums">{formatDateTime(order.paid_at)}</dd>
              </div>
            )}
            {order.cash_receipt_type && (
              <div className="flex justify-between">
                <dt className="text-muted w-20 shrink-0">현금영수증</dt>
                <dd className="text-text font-bold text-right">
                  {order.cash_receipt_type}
                </dd>
              </div>
            )}
            {order.receipt_url && (
              <div className="flex justify-between items-center">
                <dt className="text-muted w-20 shrink-0">영수증</dt>
                <dd className="text-right">
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

          {/* UI audit: 가격 합계 우측 — tabular-nums 로 자릿수 정렬 (우측 끝 일직선). */}
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">상품 금액</dt>
              <dd className="text-text font-bold tabular-nums">
                {order.subtotal.toLocaleString()}원
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">배송비</dt>
              <dd className="text-text font-bold tabular-nums">
                {order.shipping_fee === 0
                  ? '무료'
                  : `${order.shipping_fee.toLocaleString()}원`}
              </dd>
            </div>
            {/* ★할인 줄이 없어서 상품금액과 총결제 차이가 설명 없이 남았다
                (2026-08-08 금액 감사). 나무 등급 고객은 35,850원이 그냥 사라진
                것처럼 보였다 — 청구 크론은 이 값을 저장하고 있었는데 읽는
                화면이 없었다. */}
            {(order.discount_amount ?? 0) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">
                  {discountReasonLabel(order.discount_reason)}
                </dt>
                <dd className="text-moss font-bold tabular-nums">
                  −{(order.discount_amount ?? 0).toLocaleString()}원
                </dd>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-rule mt-2">
              <dt
                className="font-bold"
                style={{ fontSize: 13, color: 'var(--ink)' }}
              >
                총 결제 금액
              </dt>
              <dd className="flex items-baseline gap-1">
                <span
                  className="font-serif tabular-nums"
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
                <dd className="text-[13px] font-bold text-sale tabular-nums">
                  −{(order.refunded_amount ?? 0).toLocaleString()}원
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 주문 취소: 배송 시작 전에만 노출 */}
      {isCancellable && (
        <section className="px-5 mt-3">
          <CancelOrderButton orderId={order.id} />
        </section>
      )}
      {isPaidSubscriptionBox && (
        <p className="px-5 mt-3 text-[12px] leading-relaxed text-muted">
          결제된 정기배송 박스는 맞춤으로 만들어 그대로 보내드려서 직접 취소할 수 없어요. 다음 박스는 정기배송 관리에서 결제 전에
          미루거나 해지할 수 있어요. 사정이 있으시면 1:1 문의로 알려 주세요.
        </p>
      )}
    </main>
    </AuthAwareShell>
  )
}
