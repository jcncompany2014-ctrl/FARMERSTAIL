import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { carrierMeta } from '@/lib/tracking'
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

  return (
    <AuthAwareShell>
    <main className="pb-8 mx-auto" style={{ maxWidth: 1024 }}>
      <section className="px-5 pt-6 md:pt-8 md:px-6">
        <Link
          href={`/mypage/orders/${order.id}`}
          className="text-[11px] md:text-[12.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 상세
        </Link>
        <span className="kicker mt-3 block">Tracking · 운송장</span>
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
