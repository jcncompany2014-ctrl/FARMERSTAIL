import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/order-expire
 *
 * 30분+ 미결제 (payment_status='pending', order_status='pending') 주문을
 * expired 로 전환 + 예약된 stock 을 복원.
 *
 * # 왜 필요한가 — **근거가 절반은 옛말이다** (2026-07-31 정정)
 * 원래 이유: "CheckoutForm 이 reserve_order_stock RPC 로 사전 차감하므로
 * 사용자가 Toss 페이지에서 이탈하면 stock 이 묶인다."
 * → **지금 그 예약을 하는 코드가 없다.** 낱개 커머스 폐지로
 *   `reserve_order_stock` 호출처가 0이 됐다(DB 함수와 이 주석만 남았다).
 *
 * 그래도 이 크론은 필요하다: 구독 청구(subscription-charge)가 **토스를 긁기
 * 전에** pending 주문을 만들기 때문에, 그 사이 크론이 타임아웃·크래시하면
 * pending 주문이 남는다. 그걸 정리하는 것이 지금의 역할이다.
 * ⚠️ 다만 그 주문은 재고를 예약한 적이 없으므로 **복원하면 안 된다** —
 *    아래 복원 루프의 `reservedStock` 분기 참조.
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
    .select('id, user_id, order_number, subscription_id')
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

  const allCandidates = (orders ?? []) as Array<{
    id: string
    user_id: string
    order_number: string
    /** 구독 청구가 만든 주문인지 — 재고 복원 여부가 갈린다(아래 주석). */
    subscription_id: string | null
  }>

  /**
   * ★결제 흔적이 있는 주문은 만료시키지 않는다 (2026-08-12 3라운드 감사).
   *
   * 구독 청구(KST 09:10)는 **카드를 먼저 긁고** orders 를 paid/preparing 으로
   * 올린다. 그 UPDATE 가 실패하면 주문은 pending/pending 으로 남는데, 17시간 뒤
   * 이 크론이 그걸 "30분 결제 미완료" 로 취소했다. 결과:
   *  · 카드는 긁혔는데 고객 주문내역엔 '취소됨'
   *  · 피킹 리스트의 유실 방지 역추적은 order_status='preparing' 조건이라 못 잡음
   *    → **박스가 영영 안 나감**
   *  · 주간 원장 대조도 cancelled 를 정상으로 읽어 초록 통과
   *  · 다음 회차는 unresolved 가드에 걸려 영구 skip → 구독이 조용히 멈춤
   *
   * 원장(payment_events, amount>0)이 **돈이 움직였다는 증거**다. 그게 있으면
   * 만료 대상에서 빼고 운영자에게 알린다 — 조용히 취소하는 것보다 낫다.
   */
  const targets: typeof allCandidates = []
  let paidSkipped = 0
  if (allCandidates.length > 0) {
    const { data: paidEv, error: paidEvErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            in: (
              c: string,
              v: string[],
            ) => {
              gt: (
                c: string,
                v: number,
              ) => Promise<{
                data: Array<{ order_id: string }> | null
                error: { message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('payment_events')
      .select('order_id')
      .in(
        'order_id',
        allCandidates.map((o) => o.id),
      )
      .gt('amount', 0)
    // 규칙1 — 조회 실패를 "결제 흔적 없음"으로 읽으면 결제된 주문을 취소한다.
    //   확인 못 하면 이번 회차는 아무것도 만료시키지 않는다(안전한 쪽).
    if (paidEvErr) {
      captureBusinessEvent('error', 'order.expire.paid_check_failed', {
        candidates: allCandidates.length,
        dbError: String(paidEvErr.message ?? 'unknown'),
        note: '결제 흔적 조회 실패 — 이번 회차 만료를 전부 건너뛴다(결제된 주문 취소 방지).',
      })
      return NextResponse.json({
        ok: true,
        expired: 0,
        skipped: allCandidates.length,
        reason: 'paid_check_failed',
      })
    }
    const paidIds = new Set((paidEv ?? []).map((e) => e.order_id))
    for (const ord of allCandidates) {
      if (paidIds.has(ord.id)) {
        paidSkipped += 1
        captureBusinessEvent('error', 'order.expire.paid_order_skipped', {
          orderId: ord.id,
          orderNumber: ord.order_number,
          subscriptionId: ord.subscription_id,
          note:
            '결제 원장이 있는데 주문이 pending 이다 — 청구 후 orders UPDATE 가 실패한 건. ' +
            '만료시키지 않았다. 수동으로 paid/preparing 으로 올려야 박스가 나간다.',
        })
        continue
      }
      targets.push(ord)
    }
  }

  let expired = 0
  // 품목을 못 읽어 재고 복원이 누락된 건 — 안 세면 조용히 사라진다.
  let itemsFailed = 0
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
    const { data: claimed, error: claimedErr } = await supabase
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
    // 선점 실패를 "만료할 주문 없음"으로 읽으면 미결제 주문이 영영 안 닫힌다.
    if (claimedErr) {
      console.error('[order-expire] 만료 대상 선점 실패:', claimedErr.message)
      return NextResponse.json(
        { ok: false, reason: 'claim_failed', error: claimedErr.message },
        { status: 500 },
      )
    }
    if (!claimed || claimed.length === 0) {
      // 사용자가 그 사이 결제 완료(confirm → paid) → 건드리지 않고 다음 주문.
      continue
    }

    // 1) 항목 fetch + stock 복원. (선점 성공한 주문만)
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, line_total')
      .eq('order_id', ord.id)
      .is('cancelled_at', null)
    // 재고 복구용 품목 조회 — 실패를 "품목 없음"으로 읽으면 재고가 영영
    // 안 돌아온다. 주문은 이미 취소됐으니 이 건만 남기고 사람에게 알린다.
    if (itemsErr) {
      // ★주문은 이미 위에서 cancelled 로 선점됐다. 다음 실행은
      //   payment_status='pending' 조건이 안 맞아 **이 주문을 다시 못 잡는다**
      //   → 재고 복원·cancelled_at 마킹이 영구 누락된다.
      //   그래서 여기서 끝내되, 주석이 약속한 대로 **실제로** 사람에게 알린다
      //   (전엔 console.error 뿐이었다 — 규칙4: 없는 방어를 주장하는 주석).
      console.error('[order-expire] 주문 품목 조회 실패(재고 미복구):', ord.id, itemsErr.message)
      captureBusinessEvent('error', 'order.expire.items_lookup_failed', {
        orderId: ord.id,
        note: '주문은 취소됐는데 품목을 못 읽어 재고 복원·항목 마킹이 누락됨 — 수동 확인 필요',
      })
      itemsFailed += 1
      continue
    }
    const itemsArr = (items ?? []) as Array<{
      id: string
      product_id: string
      quantity: number
      line_total: number
    }>

    /**
     * ★ 재고는 **예약했던 주문만** 되돌린다 (2026-07-31).
     *
     * 이 크론의 존재 이유는 "CheckoutForm 이 `reserve_order_stock` 으로 사전
     * 차감하니 이탈하면 회수해야 한다" 였다. 그런데 **지금 그 예약을 하는 코드가
     * 없다** — 낱개 커머스가 폐지되면서 `reserve_order_stock` 호출처가 0이 됐다
     * (DB 함수와 이 주석만 남았다).
     *
     * 반면 구독 청구는 `order_items` 를 **만든다**(subscription-charge). 그래서
     * 구독 주문이 30분 넘게 pending 으로 남으면(주문 생성 직후 크론이 타임아웃·
     * 크래시한 경우) 여기서 **차감한 적 없는 재고가 늘어난다** — 조용한 유령 증가다.
     * 그러면 피킹 리스트가 품절을 못 잡고 어드민 재고가 거짓이 된다.
     *
     * 그래서 `subscription_id` 가 있는 주문은 **복원하지 않는다.** 품목의
     * `cancelled_at` 마킹은 그대로 한다 — 그건 재고와 무관한 이력이다.
     * (낱개 카탈로그가 부활해 예약을 다시 하게 되면, 그 주문에는
     *  subscription_id 가 없으므로 이 분기 그대로 복원된다.)
     */
    const reservedStock = ord.subscription_id === null
    for (const it of itemsArr) {
      if (reservedStock) {
        await supabase.rpc('restore_stock', {
          p_product_id: it.product_id,
          p_qty: it.quantity,
        })
      }
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
    itemsFailed,
    // 결제 원장이 있는데 pending 인 주문 — 청구 후 orders UPDATE 실패의 흔적.
    // 0 이 아니면 사람이 손봐야 한다(박스가 안 나가고 다음 회차도 멈춘다).
    paidSkipped,
  })
}
