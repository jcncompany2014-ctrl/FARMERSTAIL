import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteShell from '@/components/store/SiteShell'
import { isStoreOrderNumber } from '@/lib/store/order-number'
import { shipDateLabel, storeShipDate } from '@/lib/store/shipping'
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
// 날짜는 formatKstKoDateTime(서버 ICU 의 "AM 07:00" 함정 — 2026-10-09 실측). 예전 웹 판의 formatDateTime 은 웹 판과 함께 지웠다.

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
  // ★2026-10-10 웹 리뉴얼: 웹도 같은 화면(OrderDetailAppView)을 새 웹 가게 틀(SiteShell)에 담는다 — 예전 웹 판은 git 이력.
  {
    const isApp = await isAppContextServer()
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
    } else if (isPaid && !isCancelled && isStoreOrderNumber(order.order_number) && order.order_status === 'preparing') {
      // 웹 가게 주문(2026-10-10) — 주문한 날(KST) 다음의 첫 화·목 출고(lib/store/shipping). 도착 요일은 약속하지 않는다.
      const shipIso = storeShipDate(kstDateOf(order.created_at))
      shipRows.push({ label: '출고 예정', value: shipDateLabel(shipIso), strong: true })
      shipRows.push({ label: '도착', value: '출고하고 지역에 따라 하루나 이틀' })
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
      <SiteShell>
        {!isApp && (
          <h1 className="d" style={{ margin: 0, padding: '28px 20px 0', fontSize: 34, lineHeight: 1.1 }}>
            주문 상세
          </h1>
        )}
        <OrderDetailAppView m={model} />
      </SiteShell>
    )
  }
}
