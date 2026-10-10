import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
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

  return (
    <AuthAwareShell>
    <main className="pb-8 mx-auto" style={{ maxWidth: 1024 }}>
      <section className="px-5 pt-6 md:pt-8 md:px-6">
        <Link
          href={`/mypage/orders/${order.id}`}
          className="ft-app-back-hide text-[11px] md:text-[12.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 상세
        </Link>
        <span className="kicker mt-3 block">Tracking</span>
        <h1
          className="font-serif mt-1.5 md:mt-3 text-[22px] md:text-[34px] lg:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          운송장 조회
        </h1>
        <p className="text-[11px] md:text-[13px] text-muted mt-1 md:mt-2 font-mono">
          {order.order_number}
        </p>
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
      />
    </main>
    </AuthAwareShell>
  )
}
