import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

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
  return trackCron('order-expire', () => runOrderExpire())
}

async function runOrderExpire(): Promise<Response> {
  const supabase = createAdminClient()
  const cutoff = new Date(
    Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000,
  ).toISOString()

  // 가상계좌는 24h 입금 대기라 expire 대상 아님 — 별도 webhook 만 처리.
  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, user_id, order_number')
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
    order_number: string
  }>

  let expired = 0
  for (const ord of targets) {
    const nowIso = new Date().toISOString()

    // R100-2 (High): 주문을 stock 복원보다 먼저 원자적으로 선점한다.
    //   payment_status='pending' AND order_status='pending' 가드 + .select() 로
    //   0-row 면 그 주문 전체를 skip. 이전엔 stock 복원/cancelled_at 마킹을 먼저
    //   하고 orders UPDATE 에 가드가 없어서, 후보 SELECT(line 59) 직후 사용자가
    //   confirm 으로 paid 전환하면 cron 이 그 paid 주문을 expired 로 덮고 재고까지
    //   복원 → 결제 성사 주문이 사라지고 재고가 유령 증가했다. confirm 라우트는
    //   반대 방향(.eq('payment_status','pending'))을 자체 가드하므로, 선점 가드를
    //   여기에 추가하면 양방향 레이스가 닫힌다.
    const { data: claimed } = await supabase
      .from('orders')
      .update({
        payment_status: 'cancelled',
        // 데이터정합 감사: order_status FSM(lib/commerce/order-fsm.ts)에 'expired'
        // 미정의 → 마이페이지 라벨 공란 + cancel 라우트 INVALID_DB_STATE 500.
        // 'cancelled' 로 통일(자동만료 구분은 cancel_reason 에 보존). 기존 expired
        // 주문 0건 확인.
        order_status: 'cancelled',
        cancelled_at: nowIso,
        cancel_reason: '30분 결제 미완료 자동 만료',
      })
      .eq('id', ord.id)
      .eq('payment_status', 'pending')
      .eq('order_status', 'pending')
      .select('id')
    if (!claimed || claimed.length === 0) {
      // 사용자가 그 사이 결제 완료(confirm → paid) → 건드리지 않고 다음 주문.
      continue
    }

    // 1) 항목 fetch + stock 복원. (선점 성공한 주문만)
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

    // R61 — 결제 원장 event. 미완료 만료는 결제 자체 없으니 amount=0.
    {
      const { recordPaymentEvent } = await import('@/lib/payment-events')
      await recordPaymentEvent(supabase, {
        orderId: ord.id,
        eventType: 'cancel_requested',
        amount: 0,
        prevStatus: 'pending',
        newStatus: 'cancelled',
        source: 'cron_order_expire',
        metadata: { reason: '30분 결제 미완료 자동 만료' },
      })
    }

    // 4) 포인트 환급 제거 (2026-07-16 포인트 전면 폐기) — 주문에 사용된 포인트라는
    //    개념이 사라졌다. 재고 복원(위)은 그대로.

    expired += 1
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    checked: targets.length,
    expired,
  })
}
