import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/order-expire
 *
 * 30분+ 미결제 (payment_status='pending', order_status='pending') 주문을
 * expired 로 전환 + 예약된 stock 을 복원.
 *
 * # 왜 필요한가
 * CheckoutForm 이 reserve_order_stock RPC 로 사전 차감하므로 사용자가 Toss
 * 페이지에서 이탈하면 stock 이 묶임. 정해진 만료 시간에 cron 이 회수해야
 * 다른 사용자가 살 수 있다.
 *
 * # 30분 기준
 * Toss 결제창 timeout 기본 ~30분. virtual account (24h) 는 별도 — 가상계좌는
 * payment_method='VIRTUAL_ACCOUNT' AND virtual_account_due_date 가 있으니
 * 그 시각까지 보존.
 *
 * # 처리
 *   1. order 후보 select (pending + 30분+ 경과 + virtual account 아님)
 *   2. 각 order 마다 order_items.cancelled_at 마킹 + restore_stock RPC
 *   3. orders.payment_status='cancelled', order_status='expired',
 *      cancel_reason='30분 결제 미완료 자동 만료'
 *   4. 포인트 / 쿠폰 보상 — pending 주문은 결제 전이라 별도 처리 불요
 *      (포인트는 차감됐을 수 있어 환급)
 *
 * # 보안
 * isAuthorizedCronRequest — Bearer CRON_SECRET.
 */

const MAX_PER_RUN = 100
const EXPIRE_AFTER_MINUTES = 30

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const cutoff = new Date(
    Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000,
  ).toISOString()

  // 가상계좌는 24h 입금 대기라 expire 대상 아님 — 별도 webhook 만 처리.
  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, user_id, points_used, order_number')
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending')
    .lt('created_at', cutoff)
    .or('payment_method.is.null,payment_method.neq.VIRTUAL_ACCOUNT')
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  const targets = (orders ?? []) as Array<{
    id: string
    user_id: string
    points_used: number
    order_number: string
  }>

  let expired = 0
  for (const ord of targets) {
    // 1) 항목 fetch + stock 복원.
    const { data: items } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, line_total')
      .eq('order_id', ord.id)
      .is('cancelled_at', null)
    const itemsArr = (items ?? []) as Array<{
      id: string
      product_id: string
      quantity: number
      line_total: number
    }>
    const nowIso = new Date().toISOString()

    for (const it of itemsArr) {
      await supabase.rpc('restore_stock', {
        p_product_id: it.product_id,
        p_qty: it.quantity,
      })
      await supabase
        .from('order_items')
        .update({ cancelled_at: nowIso })
        .eq('id', it.id)
    }

    // 2) order 마감.
    await supabase
      .from('orders')
      .update({
        payment_status: 'cancelled',
        order_status: 'expired',
        cancelled_at: nowIso,
        cancel_reason: '30분 결제 미완료 자동 만료',
      })
      .eq('id', ord.id)

    // 3) 포인트 환급 — pending 단계에서 사용한 포인트가 있으면 회수.
    if (ord.points_used > 0) {
      await supabase.from('points_ledger').insert({
        user_id: ord.user_id,
        delta: ord.points_used,
        reason: '주문 만료 포인트 환급',
        reference_type: 'order_expire',
        reference_id: ord.id,
      })
      // points_balance 함수가 ledger 합으로 계산되면 row insert 만으로 충분.
    }

    expired += 1
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    checked: targets.length,
    expired,
  })
}
