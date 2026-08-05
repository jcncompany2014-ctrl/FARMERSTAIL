/**
 * R69 — 결제 원장 정합성 검증 cron.
 *
 * orders.payment_status / orders.refunded_amount vs payment_events SUM
 * 비교. 불일치 시 Sentry alert.
 *
 * # 의미
 *  - 원장 (payment_events) 이 진실의 원천. orders 는 snapshot.
 *  - 둘이 어긋나면 코드 버그 / 누락 wiring / race condition 신호.
 *  - 자동 수정 X — 사람이 확인 후 결정 (잘못된 데이터 영원히 남는 게 옳음).
 *
 * # 일정 — 매주 일 03:00 KST (조용한 시간)
 *
 * # Side effects
 *  - 불일치 row 식별 → Sentry 이벤트 기록 (captureBusinessEvent, warning).
 *    직접 메일 발송은 안 한다 — 운영 이상 통보는 매일 ops-digest cron 이
 *    cron_health 등과 함께 운영자(business.email)에게 종합 메일로 보낸다.
 *
 * # 보안 — Bearer CRON_SECRET
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import {
  findLedgerMismatches,
  type OrderSnapshot,
  type LedgerEvent,
} from '@/lib/payment-reconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('payment-ledger-reconcile', async () => {
    const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  // 1) 최근 30일 paid/refunded 주문 list
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: ordersRaw, error: ordersErr } = await admin
    .from('orders')
    .select('id, payment_status, total_amount, refunded_amount')
    .gte('created_at', since)
    // R85-E4: 'partial_refund' (밑줄 1개) 는 DB CHECK 에 없는 잘못된 enum.
    // R83-1 + R85-E1 후 정식 값은 'partially_refunded'. 이전엔 reconcile 이
    // 부분환불 주문 영구 누락 (false negative ledger mismatch).
    .in('payment_status', ['paid', 'cancelled', 'partially_refunded', 'refunded'])
    .limit(2000)
  // ★조회 실패로 대조를 못 하면 **"일치"가 아니라 "모름"이다**(2026-08-05).
  //   빈 배열로 접으면 mismatch 0 → 크론 초록 → 장부가 갈라져도 아무도 모른다.
  //   원장 대조는 돈이 맞는지 보는 마지막 그물이라, 못 쳤으면 못 쳤다고 해야 한다.
  if (ordersErr) {
    console.error('[ledger-reconcile] orders 조회 실패:', ordersErr.message)
    return NextResponse.json(
      { ok: false, reason: 'orders_lookup_failed', error: ordersErr.message },
      { status: 500 },
    )
  }
  const orders = (ordersRaw ?? []) as OrderSnapshot[]
  if (orders.length === 0) {
    return NextResponse.json({ ok: true, message: 'no orders to check' })
  }

  // 2) 같은 order_id 의 payment_events SUM
  const orderIds = orders.map((o) => o.id)
  const { data: eventsRaw, error: eventsErr } = await admin
    .from('payment_events')
    .select('order_id, amount')
    .in('order_id', orderIds)
  if (eventsErr) {
    console.error('[ledger-reconcile] payment_events 조회 실패:', eventsErr.message)
    return NextResponse.json(
      { ok: false, reason: 'events_lookup_failed', error: eventsErr.message },
      { status: 500 },
    )
  }
  const events = (eventsRaw ?? []) as LedgerEvent[]

  // 3) 정합성 비교 (pure helper) — 금액(total-refunded vs ledger) 불일치.
  const mismatches = findLedgerMismatches(orders, events)

  // 3b) 필드 불일치 — '결제 캡처(양수 ledger)가 있는데 주문은 아직 pending/failed'.
  // 금액 비교만으론 못 잡는다(pending 은 orderNet=total=ledger 라 일치로 보임).
  // subscription-charge 등에서 청구 성공 후 orders update 가 실패하면 돈은 빠졌는데
  // payment_status=pending 으로 정체 → 여기서 역방향(payment_events→orders)으로 탐지.
  const { data: posEventsRaw, error: posEventsErr } = await admin
    .from('payment_events')
    .select('order_id, amount')
    .gte('created_at', since)
    .gt('amount', 0)
    .limit(3000)
  if (posEventsErr) {
    console.error('[ledger-reconcile] 역방향 조회 실패:', posEventsErr.message)
    return NextResponse.json(
      { ok: false, reason: 'pos_events_lookup_failed', error: posEventsErr.message },
      { status: 500 },
    )
  }
  const capturedByOrder = new Map<string, number>()
  for (const e of (posEventsRaw ?? []) as LedgerEvent[]) {
    capturedByOrder.set(
      e.order_id,
      (capturedByOrder.get(e.order_id) ?? 0) + e.amount,
    )
  }
  const knownIds = new Set(orderIds)
  const extraIds = [...capturedByOrder.keys()].filter(
    (id) => id && !knownIds.has(id),
  )
  if (extraIds.length > 0) {
    const { data: extraOrders, error: extraErr } = await admin
      .from('orders')
      .select('id, payment_status, total_amount, refunded_amount')
      .in('id', extraIds)
    if (extraErr) {
      // 여기까지 왔으면 앞 단계 대조 결과는 유효하다 — 통째로 버리지 않고,
      // 이 구간을 못 봤다는 사실만 남긴다(0건으로 접지 않는다).
      console.error('[ledger-reconcile] 추가 주문 조회 실패:', extraErr.message)
      mismatches.push({
        orderId: '(역방향 구간 확인 실패)',
        status: extraErr.message,
        orderNetExpected: 0,
        ledgerBalance: 0,
        diff: 0,
      })
    }
    for (const o of (extraOrders ?? []) as OrderSnapshot[]) {
      // paid/refunded 등 정상 상태는 위 1) 에서 이미 검사됨. pending/failed 인데
      // 양수 캡처가 있으면 '결제됐는데 미확정' 이상.
      if (o.payment_status === 'pending' || o.payment_status === 'failed') {
        const captured = capturedByOrder.get(o.id) ?? 0
        mismatches.push({
          orderId: o.id,
          status: `${o.payment_status}_but_captured`,
          orderNetExpected: 0,
          ledgerBalance: captured,
          diff: captured,
        })
      }
    }
  }

  // 4) Sentry alert
  if (mismatches.length > 0) {
    captureBusinessEvent('warning', 'payment_ledger.mismatch', {
      total: orders.length,
      mismatchCount: mismatches.length,
      // top 10 sample (JSON 문자열 — payload size 제한)
      sample: JSON.stringify(mismatches.slice(0, 10)),
    })
  } else {
    captureBusinessEvent('info', 'payment_ledger.reconcile_ok', {
      ordersChecked: orders.length,
      eventsTotal: events.length,
    })
  }

    return NextResponse.json({
      ok: true,
      ordersChecked: orders.length,
      eventsTotal: events.length,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 50),
    })
  })
}
