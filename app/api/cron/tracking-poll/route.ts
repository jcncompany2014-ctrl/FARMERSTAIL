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
 * # 실행 주기 — 주석이 주장하던 "30분 간격"은 사실이 아니었다
 * 실제 vercel.json 은 **하루 1회**다. Vercel Hobby 플랜이 하루 1회를 넘는 크론을
 * 허용하지 않아 내려온 것이고(넘으면 빌드 시작 자체가 거부된다), 주석만 옛 값에
 * 남아 있었다. Tracker API 는 무료 + 무인증이지만 폭주 방지로 한 번에 50건
 * (MAX_PER_RUN), 호출 사이 200ms 딜레이.
 *
 * 시각: **KST 18:30 (UTC 09:30)**. 2026-07-30 에 KST 01:00 에서 옮겼다.
 *  · 01:00 은 조용시간(기본 22–08) 안이라 "배송 완료" 푸시가 영구히 안 나갔다.
 *  · 18:30 은 당일 배송이 대부분 끝난 뒤라 하루 1회로도 같은 날 안에 잡힌다.
 *
 * ⚠️ 하루 1회의 한계: 저녁 이후 도착한 건은 **다음 날** 알림이 된다.
 *    Pro 업그레이드 시 30분~1시간 간격으로 되돌릴 첫 후보 (PAYMENT_REHEARSAL.md).
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
  /**
   * 배송완료 저장이 실패한 건수 — **택배사 조회 실패(errors)와 다르다.**
   * 조회 실패는 다음 회차에 자연히 재시도되지만, 저장 실패는 같은 주문을
   * 매일 다시 후보로 만든다(알림은 이제 저장 성공 뒤에만 나가므로 중복 발송은
   * 막혔지만, 그 주문은 영원히 '배송 중'으로 남는다). 사람이 알아야 한다.
   */
  let saveFailed = 0

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

    /**
     * ★UPDATE 를 먼저 확인하고 알림은 그 뒤에 (2026-08-08 크론 감사).
     *
     * 예전엔 error 를 안 받고 곧장 푸시·메일을 보냈다. UPDATE 가 실패하면
     * `delivered_at` 이 NULL 로 남아 **다음 실행에서 같은 주문이 또 후보**가
     * 되고, 고객에게 "배송이 완료됐어요" 가 **성공할 때까지 매일** 간다.
     * 그런데 크론은 계속 초록이었다(규칙1 의 알림 쪽 짝).
     */
    const { error: deliveredErr } = await supabase
      .from('orders')
      .update({
        order_status: 'delivered',
        delivered_at: deliveredAt,
      })
      .eq('id', ord.id)

    if (deliveredErr) {
      console.error(
        '[tracking-poll] 배송완료 저장 실패 — 알림 보내지 않음',
        ord.id,
        deliveredErr.message,
      )
      errors += 1
      saveFailed += 1
      await new Promise((r) => setTimeout(r, 200))
      continue
    }

    // ★await — fire-and-forget 이면 배치 마지막 순번의 알림이 함수 반환과
    //  경합해 유실된다(R83-6 에서 다른 크론들은 이미 고쳤는데 여기만 남았다).
    await pushToUser(
      ord.user_id,
      {
        title: '배송이 완료됐어요 🐾',
        body: '주문이 도착했어요. 맛있게 드시길 바라요!',
        url: `/mypage/orders/${ord.id}`,
        tag: `order-${ord.id}-delivered`,
      },
      { category: 'order' },
    ).catch(() => null)

    await notifyOrderDelivered(supabase, {
      orderId: ord.id,
      userId: ord.user_id,
      orderNumber: ord.order_number,
      recipientName: ord.recipient_name ?? null,
      totalAmount: ord.total_amount,
    }).catch(() => null)

    delivered += 1
    await new Promise((r) => setTimeout(r, 200))
  }

  // ★저장 실패는 5xx 로 알린다 — trackCron 이 5xx 를 error 로 기록하고
  //  notifyCronError 를 띄운다(lib/cron-tracking). 200 으로 돌려주면
  //  "조용한 성공"이 되어 아무도 모른다.
  if (saveFailed > 0) {
    return NextResponse.json(
      {
        ok: false,
        code: 'DELIVERED_SAVE_FAILED',
        message: `배송완료 저장 실패 ${saveFailed}건 — 해당 주문이 '배송 중'에 남아 있어요`,
        polled,
        delivered,
        errors,
        saveFailed,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    polled,
    delivered,
    errors,
  })
}
