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
 *  - 불일치 row 식별 → Sentry breadcrumb (warning)
 *  - 결과 sample top 20 admin email 알림 (NEXT_PUBLIC_ADMIN_EMAIL)
 *
 * # 보안 — Bearer CRON_SECRET
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
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
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  // 1) 최근 30일 paid/refunded 주문 list
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: ordersRaw } = await admin
    .from('orders')
    .select('id, payment_status, total_amount, refunded_amount')
    .gte('created_at', since)
    // R85-E4: 'partial_refund' (밑줄 1개) 는 DB CHECK 에 없는 잘못된 enum.
    // R83-1 + R85-E1 후 정식 값은 'partially_refunded'. 이전엔 reconcile 이
    // 부분환불 주문 영구 누락 (false negative ledger mismatch).
    .in('payment_status', ['paid', 'cancelled', 'partially_refunded', 'refunded'])
    .limit(2000)
  const orders = (ordersRaw ?? []) as OrderSnapshot[]
  if (orders.length === 0) {
    return NextResponse.json({ ok: true, message: 'no orders to check' })
  }

  // 2) 같은 order_id 의 payment_events SUM
  const orderIds = orders.map((o) => o.id)
  const { data: eventsRaw } = await admin
    .from('payment_events')
    .select('order_id, amount')
    .in('order_id', orderIds)
  const events = (eventsRaw ?? []) as LedgerEvent[]

  // 3) 정합성 비교 (pure helper)
  const mismatches = findLedgerMismatches(orders, events)

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
}
