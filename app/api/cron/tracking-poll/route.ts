import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { carrierMeta, mapTrackerStatusCode } from '@/lib/tracking'
import { pushToUser } from '@/lib/push'
import { notifyOrderDelivered } from '@/lib/email'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/tracking-poll
 *
 * shipping 상태 + carrier + tracking_number 가 있는 주문을 Delivery Tracker
 * 공개 GraphQL API 로 조회 → state=delivered 면 자동 marking + 알림.
 *
 * # 실행 주기
 * 30분 간격 (vercel cron 표현식). Tracker API 는 무료 + 무인증이지만
 * 폭주 방지로 한 번에 50건 (MAX_PER_RUN), 호출 사이 200ms 딜레이.
 *
 * # 처리 흐름
 *   1. shipping + tracking 정보 있는 주문 select (delivered_at IS NULL)
 *   2. 각 주문에 대해 GraphQL 호출
 *   3. state=delivered 면 orders.order_status='delivered', delivered_at=lastEvent.time
 *      + 사용자에게 push + 이메일
 *   4. state=out_for_delivery + out_for_delivery_pushed=false 면 "오늘 도착
 *      예정" push (선택) — 별도 컬럼 추가 필요. 우선은 delivered 만 처리.
 *   5. 'unknown' 또는 조회 실패는 다음 cron 으로 미루고 idle.
 *
 * # 가드레일
 * - 호출 시 8s timeout (lib 동일 정책)
 * - 7일 이상 shipping 인 주문은 분리 처리 — Tracker 가 history 잃을 가능성.
 *   (현재 미구현 — admin alert 룰로 대체)
 *
 * # 보안
 * Bearer CRON_SECRET.
 */

const MAX_PER_RUN = 50
const DELIVERY_TRACKER_ENDPOINT = 'https://apis.tracker.delivery/graphql'
const QUERY = `
  query Track($carrierId: ID!, $trackingNumber: String!) {
    track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
      lastEvent {
        time
        status { code name }
      }
    }
  }
`

type DTLastEvent = {
  time: string
  status: { code: string | null; name: string | null } | null
}

type DTResponse = {
  data?: { track?: { lastEvent: DTLastEvent | null } | null }
  errors?: Array<{ message: string }>
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('tracking-poll', () => runTrackingPoll())
}

async function runTrackingPoll(): Promise<Response> {
  const supabase = createAdminClient()

  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, total_amount, recipient_name, carrier, tracking_number, shipped_at',
    )
    .eq('order_status', 'shipping')
    .not('carrier', 'is', null)
    .not('tracking_number', 'is', null)
    .is('delivered_at', null)
    .order('shipped_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  type OrderRow = {
    id: string
    user_id: string
    order_number: string
    total_amount: number
    recipient_name: string | null
    carrier: string | null
    tracking_number: string | null
    shipped_at: string | null
  }

  const targets = (orders ?? []) as OrderRow[]
  let delivered = 0
  let polled = 0
  let errors = 0

  for (const ord of targets) {
    polled += 1
    const meta = carrierMeta(ord.carrier)
    if (!meta || !meta.deliveryTrackerId || !ord.tracking_number) continue

    let lastEvent: DTLastEvent | null = null
    try {
      const res = await fetch(DELIVERY_TRACKER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: QUERY,
          variables: {
            carrierId: meta.deliveryTrackerId,
            trackingNumber: ord.tracking_number,
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        errors += 1
        continue
      }
      const json = (await res.json()) as DTResponse
      if (json.errors && json.errors.length) continue
      lastEvent = json.data?.track?.lastEvent ?? null
    } catch {
      errors += 1
      continue
    }

    const state = mapTrackerStatusCode(lastEvent?.status?.code)
    if (state !== 'delivered') {
      // 다음 cron 에서 다시. QPS 보호.
      await new Promise((r) => setTimeout(r, 200))
      continue
    }

    const deliveredAt = lastEvent?.time ?? new Date().toISOString()
    await supabase
      .from('orders')
      .update({
        order_status: 'delivered',
        delivered_at: deliveredAt,
      })
      .eq('id', ord.id)

    pushToUser(
      ord.user_id,
      {
        title: '배송이 완료됐어요 🐾',
        body: '주문이 도착했어요. 맛있게 드시길 바라요!',
        url: `/mypage/orders/${ord.id}`,
        tag: `order-${ord.id}-delivered`,
      },
      { category: 'order' },
    ).catch(() => {})

    notifyOrderDelivered(supabase, {
      orderId: ord.id,
      userId: ord.user_id,
      orderNumber: ord.order_number,
      recipientName: ord.recipient_name ?? null,
      totalAmount: ord.total_amount,
    }).catch(() => {})

    delivered += 1
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({
    ok: true,
    polled,
    delivered,
    errors,
  })
}
