import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import CheckoutClient from '@/components/store/CheckoutClient'
import { widgetClientKey } from '@/lib/store/toss-widget'
import ReceiptWebView from '@/app/mypage/orders/[id]/receipt/ReceiptWebView'
import type { ReceiptAppModel } from '@/app/mypage/orders/[id]/receipt/ReceiptAppView'
import TrackingView from '@/app/mypage/orders/[id]/track/TrackingView'
import AccountWebView from '@/app/account/AccountWebView'
import ProfileWebView from '@/app/account/profile/ProfileWebView'
import DeleteWebView from '@/app/mypage/delete/DeleteWebView'
import SubscriptionsWebClient from '@/app/account/subscriptions/SubscriptionsWebClient'
import type { Subscription } from '@/app/account/subscriptions/types'
import { carrierMeta } from '@/lib/tracking'

/**
 * /design-check-store — 웹 가게 점검(로그인 없이 시안과 나란히). **실제 사이트(production)에선 404.**
 *  · 기본: 주문서(로그인한 모습 + 토스 결제위젯 테스트 키). [결제하기]는 주문 서버가 로그인을 요구해 막힌다(401).
 *  · ?s=receipt: 웹 영수증(시안 WEB-A15) — 실제 ReceiptWebView 에 예시 값.
 *  · ?s=track: 웹 운송장 조회(시안 WEB-A16) 머리 + 실제 TrackingView(앱 화면). 조회 API 는 로그인이 없어 실패 카드가 뜬다.
 *  · ?s=account: 웹 내 계정(시안 WEB-A19) — 실제 AccountWebView 에 예시 값(새싹 등급·도장 23개 — 시안과 같은 값).
 *  · ?s=subs: 웹 정기배송 관리(시안 WEB-A23) — 실제 SubscriptionsWebClient 에 예시 두 건(버튼은 로그인이 없어 실패한다).
 *  · ?s=delete · ?s=delete-blocked: 웹 회원 탈퇴(시안 WEB-A17·A18) — 실제 DeleteWebView 에 예시 값.
 *  · ?s=profile: 웹 내 프로필(시안 WEB-A20) — 실제 ProfileWebView 에 예시 값(저장·삭제는 로그인이 없어 실패한다).
 */
export const metadata: Metadata = { title: '가게 점검', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** 웹 영수증 예시(시안 A15 와 같은 값) — 공개 캡처용 이름은 '보호자'. */
const RECEIPT_WEB: ReceiptAppModel = {
  orderNumber: 'FTS-20261008-0042',
  createdAt: '2026-10-08T11:12:00Z',
  paidAt: '2026-10-08T11:14:00Z',
  recipientName: '보호자',
  recipientPhone: '010-0000-0000',
  zip: '03900',
  address: '서울특별시 마포구 월드컵북로 00',
  addressDetail: '3층',
  deliveryMemo: '문 앞에 두세요',
  items: [
    { id: 'w1', product_name: '닭고기 화식 500g', variant_name: '500g', quantity: 1, unit_price: 24000, line_total: 24000 },
    { id: 'w2', product_name: '오리고기 화식 500g', variant_name: '500g', quantity: 1, unit_price: 27000, line_total: 27000 },
  ],
  subtotal: 51000,
  shipping: 0,
  discount: null,
  rounding: null,
  total: 51000,
  refunded: 0,
  paymentMethodText: '신용·체크카드',
}


/** 웹 정기배송 관리 예시(시안 A23 과 같은 두 건) — 다음 발송일은 오늘 기준 다음 화요일 뒤로 잡는다. */
function subsFixture(): Subscription[] {
  const base = {
    status: 'active' as const,
    interval_weeks: 2,
    coverage_weeks: 2,
    fresh_ratio: 30,
    total_deliveries: 3,
    shipping_fee: 0,
    recipient_name: '보호자',
    created_at: '2026-09-01T00:00:00Z',
    reminder_enabled: true,
    reminder_days_before: 1,
    has_billing_key: true,
    billing_card_brand: '신한',
    billing_card_last4: '1234',
    billing_customer_key: 'ck-design',
    failed_charge_count: 0,
    last_failed_charge_at: null,
    last_failed_charge_reason: null,
    last_failed_charge_code: null,
    next_retry_at: null,
    requires_billing_key_renewal: false,
  }
  const next = '2026-10-20'
  return [
    {
      ...base,
      id: 's1',
      dog_id: 'd1',
      dogs: { id: 'd1', name: '땅콩' },
      next_delivery_date: next,
      subtotal: 77840,
      total_amount: 77800,
      subscription_items: [
        { product_name: '닭고기 레시피', product_image_url: '/store/studio-chicken.webp', quantity: 14, unit_price: 2780 },
        { product_name: '흑돼지 레시피', product_image_url: '/store/studio-pork.webp', quantity: 14, unit_price: 2780 },
      ],
    },
    {
      ...base,
      id: 's2',
      dog_id: 'd2',
      dogs: { id: 'd2', name: '보리' },
      next_delivery_date: next,
      subtotal: 36400,
      total_amount: 36400,
      subscription_items: [
        { product_name: '오리 레시피', product_image_url: '/store/studio-duck.webp', quantity: 14, unit_price: 1300 },
        { product_name: '닭고기 레시피', product_image_url: '/store/studio-chicken.webp', quantity: 14, unit_price: 1300 },
      ],
    },
  ]
}

export default async function DesignCheckStorePage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { s } = await searchParams
  if (s === 'receipt') return <ReceiptWebView m={RECEIPT_WEB} orderId="design-check" print={false} />
  if (s === 'account')
    return <AccountWebView name="보호자" email="guardian@example.com" stamps={23} tierRaw="sprout" totalOrders={24} pendingOrders={1} activeSubs={2} dogCount={2} />
  if (s === 'subs')
    return (
      <StoreShell>
        <section style={{ padding: '24px 20px 64px' }}>
          <SubscriptionsWebClient
            trial={null}
            chargeTiming="before_cooking"
            paidPreparingSubIds={[]}
            paidPreparingAt={{}}
            paidStateUnknown={false}
            initialSubs={subsFixture()}
            focusSubId={null}
            priceProposal={null}
            isApp={false}
          />
        </section>
      </StoreShell>
    )
  if (s === 'delete' || s === 'delete-blocked')
    return (
      <DeleteWebView
        hasOpen={s === 'delete-blocked'}
        openOrders={s === 'delete-blocked' ? [{ id: 'o1', order_number: 'FTS-20261008-0042', order_status: 'preparing' }] : []}
        orderCount={24}
        dogCount={2}
      />
    )
  if (s === 'profile')
    return (
      <ProfileWebView
        profile={{ name: '보호자', phone: '010-0000-0000', tier: 'sprout', stamp_count: 23 }}
        email="guardian@example.com"
        addresses={[{ id: 'a1', label: '', recipientName: '보호자', phone: '010-0000-0000', zip: '03900', address: '서울특별시 마포구 월드컵북로 00', addressDetail: '3층', isDefault: true }]}
        canResetPassword
      />
    )
  if (s === 'track') {
    const meta = carrierMeta('cj')
    return (
      <StoreShell>
        <section style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h1 className="d" style={{ margin: '52px 0 0', fontSize: 36, lineHeight: 1.1 }}>
            운송장 조회
          </h1>
        </section>
        <TrackingView
          carrier="cj"
          carrierLabel={meta?.label ?? null}
          trackingNumber="601234567890"
          orderStatus="delivered"
          shippedAt="2026-09-29T06:20:00Z"
          deliveredAt="2026-09-30T04:40:00Z"
          recipientName="보호자"
          trackerDeepLink={meta ? meta.trackerUrl('601234567890') : null}
          supportsInline={Boolean(meta?.deliveryTrackerId)}
          app={{ orderNumber: 'FTS-20260926-K3P9QX', web: true }}
        />
      </StoreShell>
    )
  }
  return (
    <StoreShell header={{ variant: 'title', title: '주문·결제', backHref: '/store/cart' }} footer={false}>
      <CheckoutClient
        signedIn
        displayName="보호자"
        email={null}
        prefill={{ name: '보호자', phone: '010-0000-0000', zip: '21990', address: '인천광역시 연수구 송도과학로28번길 50', addressDetail: '121호' }}
        buy={{ id: 'chicken-500g', qty: 2 }}
        clientKey={widgetClientKey()}
        customerKey="ft-design-check-store"
      />
    </StoreShell>
  )
}
