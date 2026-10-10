import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import SiteShell from '@/components/store/SiteShell'
import { carrierMeta } from '@/lib/tracking'
import { isAppContextServer } from '@/lib/app-context'
import TrackingView from './TrackingView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '운송장 조회',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

export default async function TrackPage({ params }: { params: Params }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/mypage/orders/${id}/track`)

  // user_id scope is critical — admins bypass RLS for this table, so always
  // constrain to the authenticated user here.
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, carrier, tracking_number, order_status, shipped_at, delivered_at, recipient_name'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !order) notFound()

  const meta = carrierMeta(order.carrier)
  const trackerDeepLink =
    meta && order.tracking_number
      ? meta.trackerUrl(order.tracking_number)
      : null

  // 앱은 앱 화면으로(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 M10·I09·I10). 제목·←(주문 상세)는 앱 윗줄이
  // 그리므로 아래 웹 머리말(Tracking · 운송장 조회)은 빼고, 조회 상태·동작은 같은 TrackingView 가 맡는다.
  if (await isAppContextServer()) {
    return (
      <AuthAwareShell>
        <TrackingView
          carrier={order.carrier}
          carrierLabel={meta?.label ?? null}
          trackingNumber={order.tracking_number}
          orderStatus={order.order_status}
          shippedAt={order.shipped_at}
          deliveredAt={order.delivered_at}
          recipientName={order.recipient_name}
          trackerDeepLink={trackerDeepLink}
          supportsInline={Boolean(meta?.deliveryTrackerId)}
          app={{ orderNumber: order.order_number }}
        />
      </AuthAwareShell>
    )
  }

  // 웹 — 2026-10-10 웹 리뉴얼(웹 시안 WEB-A16): 앱과 같은 운송장 화면(TrackingAppView — 송장 카드·진행 상태·배송 이력)을
  //   새 웹 가게 틀(SiteShell)에 담고, 위에 '← 주문 상세'·큰 제목만 더한다(앱은 윗줄이 맡는다).
  //   예전 웹 판(영어 머리말 Tracking·세리프 제목)은 git 이력.
  return (
    <SiteShell>
      <section style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <Link
          href={`/mypage/orders/${order.id}`}
          style={{
            alignSelf: 'flex-start',
            minHeight: 48,
            marginLeft: -6,
            paddingRight: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 16,
            fontWeight: 700,
            color: '#3D3D3D',
            textDecoration: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          주문 상세
        </Link>
        <h1 className="d" style={{ margin: '4px 0 0', fontSize: 36, lineHeight: 1.1 }}>
          운송장 조회
        </h1>
      </section>
      <TrackingView
        carrier={order.carrier}
        carrierLabel={meta?.label ?? null}
        trackingNumber={order.tracking_number}
        orderStatus={order.order_status}
        shippedAt={order.shipped_at}
        deliveredAt={order.delivered_at}
        recipientName={order.recipient_name}
        trackerDeepLink={trackerDeepLink}
        supportsInline={Boolean(meta?.deliveryTrackerId)}
        app={{ orderNumber: order.order_number, web: true }}
      />
    </SiteShell>
  )
}
