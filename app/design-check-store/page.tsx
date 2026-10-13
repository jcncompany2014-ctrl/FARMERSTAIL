import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import CheckoutClient from '@/components/store/CheckoutClient'
import ProductDetail from '@/components/store/ProductDetail'
import CartView from '@/components/store/CartView'
import StoreBrowse from '@/components/store/StoreBrowse'
import RecipeGrid from '@/components/store/RecipeGrid'
import MagazineDraftPreview from './MagazineDraftPreview'
import { widgetClientKey } from '@/lib/store/toss-widget'
import { fetchRecipeLabels, trialNoticeRows } from '@/lib/store/label'
import { business } from '@/lib/business'
import ReceiptWebView from '@/app/mypage/orders/[id]/receipt/ReceiptWebView'
import type { ReceiptAppModel } from '@/app/mypage/orders/[id]/receipt/ReceiptAppView'
import TrackingView from '@/app/mypage/orders/[id]/track/TrackingView'
import AccountWebView from '@/app/account/AccountWebView'
import ProfileWebView from '@/app/account/profile/ProfileWebView'
import DeleteWebView from '@/app/mypage/delete/DeleteWebView'
import DoneWebView from '@/app/start/done/DoneWebView'
import SubscriptionsWebClient from '@/app/account/subscriptions/SubscriptionsWebClient'
import type { Subscription } from '@/app/account/subscriptions/types'
import { carrierMeta } from '@/lib/tracking'

/**
 * /design-check-store — 웹 가게 점검(로그인 없이 시안과 나란히). **실제 사이트(production)에선 404.**
 *  · 기본: 주문서(로그인한 모습 + 토스 결제위젯 테스트 키). [결제하기]는 주문 서버가 로그인을 요구해 막힌다(401).
 *  · ?s=testmode-checkout: 같은 주문서 + 결제 시험 기간 안내(운영 + 테스트 결제창 키일 때만 켜지는 모양, 규칙209).
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

export default async function DesignCheckStorePage({ searchParams }: { searchParams: Promise<{ s?: string; m?: string; f?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { s, m, f } = await searchParams
  // 매거진 초안 미리보기 — docs/magazine/<m>/<f>.md 를 글 화면 모양으로(사장님 확인용, 2026-10-11).
  if (s === 'magazine-draft') return <MagazineDraftPreview month={m ?? '2026-10'} file={f ?? ''} />
  if (s === 'receipt') return <ReceiptWebView m={RECEIPT_WEB} orderId="design-check" print={false} />
  // 자사몰 결제 막음(스마트스토어 안내) — 운영에만 켜지는 모양이라(미리보기·로컬은 테스트 키) 여기서 켠 채로 본다(규칙177).
  if (s === 'paused-home')
    return (
      <StoreShell>
        <section style={{ padding: '64px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>
            레시피 4종
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 17, color: '#595959' }}>모두 100g 팩 5개, 500g 한 봉이에요</p>
          <div style={{ marginTop: 20 }}>
            <RecipeGrid paused />
          </div>
        </section>
      </StoreShell>
    )
  if (s === 'paused-store' || s === 'paused-trial') {
    const labels = await fetchRecipeLabels()
    return (
      <StoreShell>
        <StoreBrowse initialTab={s === 'paused-trial' ? 'trial' : 'recipes'} trialNotice={labels ? trialNoticeRows(labels, { phone: business.phone }) : null} paused />
      </StoreShell>
    )
  }
  if (s === 'paused-product')
    return (
      <StoreShell header={{ variant: 'back', backHref: '/store' }}>
        <ProductDetail recipe="chicken" label={null} paused />
      </StoreShell>
    )
  if (s === 'paused-cart')
    return (
      <StoreShell header={{ variant: 'title', title: '장바구니', backHref: '/store' }} footer={false}>
        <CartView paused />
      </StoreShell>
    )
  // 웹 가입 완료(행사 링크 손님) — 혜택·추천 구성은 로그인한 사람만 보이는 칸이라 예시 값으로 확인한다.
  if (s === 'start-done')
    return <DoneWebView who="땅콩이" box={{ recipes: '치킨 · 흑돼지', dailyGrams: 240, total: 61800 }} promo={{ name: '부산 펫박람회', ratePct: 30 }} />
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
        clientKey={s === 'paused-checkout' ? null : widgetClientKey()}
        customerKey="ft-design-check-store"
        paused={s === 'paused-checkout'}
        testMode={s === 'testmode-checkout'}
      />
    </StoreShell>
  )
}
