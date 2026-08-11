import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { fetchPayment, type TossPaymentStatus } from '@/lib/payments/toss'
import { notifyOrderCancelled, notifyOrderPlaced } from '@/lib/email'
import { captureBusinessEvent } from '@/lib/sentry/trace'
// R91-D #1 (D7): amount mismatch / 위변조는 fatal alert helper 로 통일.
// captureBusinessEvent 옆에 alert 호출도 추가 → Sentry rule 의 kind 태그
// 매칭으로 즉시 운영자 채널 라우팅.
import { alertAmountMismatch } from '@/lib/sentry/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Toss Payments webhook receiver.
 *
 * Why this exists (even though /api/payments/confirm already records paid orders):
 *   • Users who close the tab mid-card-flow don't trigger confirm.
 *     Toss still sends the webhook so we can finalize state.
 *   • Refunds initiated via Toss dashboard (manual ops) only surface
 *     through the webhook.
 *
 * ★ 2026-07-31 주석 정정 — 예전엔 **가상계좌(입금 대기)를 첫 번째 이유**로 적고
 *   있었다. 지금 우리 흐름에서는 가상계좌가 생기지 않는다: 구독 전용이라 결제는
 *   전부 빌링키(카드·토스페이)이고(lib/payments/billing-methods), 낱개 커머스는
 *   폐지됐다. `orders.payment_method` 는 **토스가 준 값을 그대로 저장**할 뿐
 *   우리가 고르지 않는다(confirm·webhook 두 곳).
 *   저장소 곳곳의 가상계좌 분기(order-expire · self-cancel · partial-cancel)는
 *   **지우지 않는다** — 토스 대시보드에서 수동으로 만든 결제가 웹훅으로 들어올
 *   수 있고, 환불에 수신 계좌가 필요한 것도 그 경우 맞다. 다만 그건 **휴면 가드**
 *   이지 상시 경로가 아니다. 이 구분이 흐려지면 "가상계좌를 지원한다"고 오해한다.
 *
 * Security model:
 *   Toss does NOT sign webhooks with HMAC. The official recommendation
 *   is to re-fetch the payment from Toss using the paymentKey — that
 *   read requires the Secret Key, so an attacker forging a webhook
 *   body can't lie about the payment state. We trust the re-fetched
 *   status, not the webhook body.
 *
 * Idempotency:
 *   Toss retries on non-2xx. Handler reads current order state and
 *   short-circuits if already in the target status.
 *
 * Env:
 *   TOSS_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

type WebhookBody = {
  eventType?: string
  createdAt?: string
  data?: {
    paymentKey?: string
    orderId?: string
    status?: TossPaymentStatus
  }
}

export async function POST(req: Request) {
  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    // Bad JSON — tell Toss to stop retrying. No business data lost
    // because confirm is still the happy-path source of truth.
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 200 })
  }

  const paymentKey = body?.data?.paymentKey
  const orderId = body?.data?.orderId // this is our order_number

  if (!paymentKey || !orderId) {
    return NextResponse.json(
      { ok: false, reason: 'missing_fields' },
      { status: 200 }
    )
  }

  // 1) Re-fetch payment from Toss — this is our truth source.
  //    lib/payments/toss 가 auth 헤더와 base URL을 책임.
  const lookup = await fetchPayment(paymentKey)
  if (!lookup.ok) {
    // Toss API itself returned an error — don't trust the webhook.
    // Return 500 so Toss retries; if it's a permanent 4xx the retry
    // budget will bleed out but at least we don't corrupt state.
    return NextResponse.json(
      { ok: false, reason: 'toss_lookup_failed', tossError: lookup.error },
      { status: 500 }
    )
  }
  const payment = lookup.data

  // Sanity: the paymentKey we looked up must match the event's paymentKey.
  if (payment.paymentKey !== paymentKey) {
    return NextResponse.json(
      { ok: false, reason: 'paymentkey_mismatch' },
      { status: 200 }
    )
  }

  // 2) 주문 찾기 — 우리가 토스에 보낸 orderId 로.
  //
  // ★결제 감사 #2 (2026-07-29): 정기결제 크론이 orders.id(UUID)를 보내고 있어서
  //   order_number 조회가 **한 건도 못 맞혔다**(모든 주문이 크론에서 나오므로
  //   웹훅이 사실상 100% 무효 — 대시보드 환불 미반영·원장 어긋남). 크론은
  //   주문번호를 보내도록 고쳤고, 여기서는 **양쪽 다 받는다**: 과거에 UUID 로
  //   보낸 결제의 웹훅(재시도·지연 도착)도 정상 처리되게.
  const supabase = createAdminClient()
  const ORDER_COLS =
    'id, user_id, order_number, total_amount, payment_status, order_status, paid_at, shipping_fee, recipient_name'
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
  let { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(ORDER_COLS)
    .eq('order_number', orderId)
    .maybeSingle()
  if (!order && isUuid) {
    const byId = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('id', orderId)
      .maybeSingle()
    order = byId.data
    orderErr = byId.error
  }
  // ★조회 **오류**는 '우리 주문 아님'과 다르다(2026-08-05 병렬 감사).
  //   이 파일의 쓰기 경로는 그 사고(AGENTS 규칙1 원사례 — DB 오류를 '이미
  //   처리됨'으로 읽고 200 → 토스 재시도 단절 → 복구 경로 0)를 failAndAskRetry
  //   로 고쳤는데, 읽기 경로가 같은 모양으로 남아 있었다. 토스 수동 환불
  //   웹훅이 오는 순간 DB 가 흔들리면 200 을 돌려줘 환불이 영영 미반영된다.
  //   여기는 아직 멱등 기록 전이라 5xx 로 재시도를 요청하면 그만이다.
  if (orderErr) {
    console.error('[webhook] 주문 조회 실패 — 재시도 요청:', orderErr.message)
    return NextResponse.json(
      { ok: false, reason: 'order_lookup_failed' },
      { status: 500 },
    )
  }

  if (orderErr || !order) {
    // Not our order. Acknowledge with 200 so Toss stops retrying —
    // a retry won't ever succeed.
    return NextResponse.json(
      { ok: false, reason: 'order_not_found' },
      { status: 200 }
    )
  }

  // 3) Amount check — if it doesn't match we have a serious problem.
  // Still ack with 200 (retries won't help), but log + Sentry for ops.
  if (payment.totalAmount !== order.total_amount) {
    // 위변조 시도 또는 Toss 와 DB 사이 데이터 불일치 — 운영자가 즉시 봐야 함.
    captureBusinessEvent('error', 'order.webhook.amount_mismatch', {
      orderId,
      paymentKey,
      orderAmount: order.total_amount,
      tossAmount: payment.totalAmount,
      orderStatus: order.payment_status,
    })
    // R91-D #1 (D7): fatal alert — business.alert.kind='amount_mismatch'
    // 태그로 Sentry rule 가 즉시 운영자 채널 라우팅.
    alertAmountMismatch({
      orderId,
      expected: order.total_amount,
      actual: payment.totalAmount,
    })
    console.error(
      `[webhook] amount mismatch order=${orderId} expected=${order.total_amount} got=${payment.totalAmount}`
    )
    return NextResponse.json(
      { ok: false, reason: 'amount_mismatch' },
      { status: 200 }
    )
  }

  // 3.5) 멱등 게이트 — (payment_key, status) 를 webhook_events 에 원자적 INSERT.
  // 동시 수신/재시도 webhook 이 같은 전이를 두 번 처리(이중 포인트 적립·환불)하는
  // race 를 봉쇄한다. 상태기반 멱등(아래 switch)만으로는 두 요청이 거의 동시에
  // "아직 paid 아님"을 읽으면 둘 다 적립하는 틈이 남는데, unique INSERT 는 한
  // 쪽만 성공(23505 충돌)이라 직렬화된다. 테이블 미적용(42P01)이면 폴백(무영향).
  // ★부분취소는 같은 결제에 여러 번 올 수 있다(운영자가 두 번에 나눠 환불).
  //   status 만으로 키를 만들면 2회째부터 duplicate 로 통째로 skip 되어 원장에
  //   안 남는다(2026-08-11 go-live 감사). 잔액(balanceAmount)은 부분취소마다
  //   줄어들어 전이마다 유일하므로 구분자로 쓴다.
  const eventKey =
    payment.status === 'PARTIAL_CANCELED'
      ? `${paymentKey}:${payment.status}:${payment.balanceAmount ?? 'na'}`
      : `${paymentKey}:${payment.status}`
  const dedup = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (
          r: Record<string, unknown>,
        ) => Promise<{ error: { code?: string } | null }>
      }
    }
  )
    .from('webhook_events')
    .insert({
      provider: 'toss',
      event_key: eventKey,
      order_id: order.id,
      payment_key: paymentKey,
      status: payment.status,
    })
  if (dedup.error?.code === '23505') {
    // 이미 같은 이벤트가 기록됨 — 동시/재시도 중복. 한 번만 처리되게 skip.
    return NextResponse.json({ ok: true, skipped: 'duplicate_event' })
  }
  // 42P01(테이블 미적용) 등 그 외 오류는 무시하고 진행 — 기존 상태기반 멱등이
  // 여전히 동작하므로 결제 처리를 막지 않는다(가용성 우선).
  const dedupRecorded = !dedup.error

  /**
   * ★DB 쓰기가 실패했을 때 (2026-07-30 최종감사 critical)
   *
   * 이전에는 update 결과에서 `error` 를 아예 꺼내지 않아 **DB 오류와 "이미 다른
   * 흐름이 처리함"이 구분되지 않았다.** 둘 다 `data` 가 비어 보이기 때문이다.
   * 그래서 오류인데도 토스에 200 을 돌려줬고 —
   *   · 토스는 성공으로 알고 **다시 보내지 않는다**
   *   · 위 멱등 기록은 이미 들어가 있어 **수동 재시도도 duplicate 로 막힌다**
   * 결과: 카드사 환불은 끝났는데 우리 DB 는 'paid/준비중' → 환불한 고객에게
   * 박스가 나가고 원장에도 환불이 안 남는다. **복구 경로가 0개였다.**
   *
   * 그래서 실패 시 ① 멱등 기록을 지워 재시도가 통하게 하고 ② 5xx 를 돌려
   * 토스가 다시 보내게 한다. 토스 재시도가 이 경로의 유일한 자동 복구 수단이다.
   */
  // 클로저 안에서는 위의 null 체크가 유지되지 않으므로 값을 미리 붙잡는다.
  const targetOrderId = order.id
  async function failAndAskRetry(
    stage: string,
    dbError: { message?: string; code?: string } | null,
  ) {
    captureBusinessEvent('error', 'payment.webhook.db_write_failed', {
      orderId: targetOrderId,
      paymentKey,
      tossStatus: String(payment.status),
      stage,
      dbError: String(dbError?.message ?? dbError?.code ?? 'unknown'),
      note: '멱등 기록을 되돌리고 5xx 로 응답 — 토스 재시도로 복구한다.',
    })
    if (dedupRecorded) {
      // 이 기록이 남으면 토스 재시도가 duplicate 로 걸러진다 → 반드시 되돌린다.
      const rollback = await (
        supabase as unknown as {
          from: (t: string) => {
            delete: () => {
              eq: (c: string, v: string) => {
                eq: (
                  c: string,
                  v: string,
                ) => Promise<{ error: { message?: string; code?: string } | null }>
              }
            }
          }
        }
      )
        .from('webhook_events')
        .delete()
        .eq('provider', 'toss')
        .eq('event_key', eventKey)
      // ★롤백 자체가 실패하면(DB 가 흔들리는 상황이면 충분히 같이 실패한다)
      //   멱등 기록이 남은 채 500 이 나가고, 토스 재시도는 전부 duplicate 로
      //   걸러진다 — 이 파일이 고치려던 "복구 경로 0" 사고가 한 겹 아래에서
      //   재현되는 것. 자동 복구는 불가능하므로 event_key 를 담아 fatal 로
      //   남긴다: 운영자가 webhook_events 에서 이 행을 지우면 토스 재시도가
      //   다시 통한다(수동 복구 절차).
      if (rollback.error) {
        captureBusinessEvent('error', 'payment.webhook.dedup_rollback_failed', {
          orderId: targetOrderId,
          paymentKey,
          eventKey,
          dbError: String(rollback.error.message ?? rollback.error.code ?? 'unknown'),
          note:
            '수동 복구: webhook_events 에서 이 event_key 행을 삭제하면 토스 재시도가 다시 처리된다.',
        })
      }
    }
    return NextResponse.json(
      { ok: false, error: 'db_write_failed', stage },
      { status: 500 },
    )
  }

  // 4) Apply state transition based on Toss status.
  switch (payment.status) {
    case 'DONE': {
      // Already final → idempotent skip.
      if (order.payment_status === 'paid') {
        return NextResponse.json({ ok: true, skipped: 'already_paid' })
      }

      const paidUpd = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: payment.method ?? null,
          payment_key: paymentKey,
          paid_at: payment.approvedAt ?? new Date().toISOString(),
          // Only promote to "preparing" if we haven't already moved forward.
          order_status:
            order.order_status === 'pending' ? 'preparing' : order.order_status,
          // 가상계좌 입금 완료 시점에야 비로소 Toss가 최종 영수증을
          // 발급하므로 여기서도 업데이트 (카드는 confirm에서 이미 세팅).
          receipt_url: payment.receipt?.url ?? null,
        })
        .eq('id', order.id)
      // ★ 여기서 실패하면 "입금됐는데 미결제로 남는다" — 도장 트리거도 안 돈다.
      if (paidUpd.error) return await failAndAskRetry('orders.paid', paidUpd.error)

      // R60 — 결제 원장 event. 가상계좌 입금 완료 또는 confirm 누락 케이스.
      {
        const { recordPaymentEvent } = await import('@/lib/payment-events')
        await recordPaymentEvent(supabase, {
          orderId: order.id,
          paymentKey,
          eventType: 'paid',
          amount: payment.totalAmount,
          prevStatus: order.payment_status,
          newStatus: 'paid',
          source: 'toss_webhook',
          metadata: { method: payment.method ?? null, approvedAt: payment.approvedAt ?? null },
        })
      }

      // 포인트 적립 제거 (2026-07-16 포인트 전면 폐기).

      // Notify the customer — virtual-account deposits are the key case.
      pushToUser(
        order.user_id,
        {
          title: '입금이 확인됐어요 🐾',
          body: `${payment.totalAmount.toLocaleString()}원 결제가 완료됐어요. 상품을 준비할게요.`,
          url: `/mypage/orders/${order.id}`,
          tag: `order-${order.id}`,
        },
        { category: 'order' },
      ).catch(() => {
        /* best-effort */
      })

      // 이메일 주문 접수 안내 — 가상계좌 입금 완료 시 최초 "정식 접수" 메일.
      // confirm 단계에서 DONE이 아닌 WAITING_FOR_DEPOSIT으로 빠진 주문은
      // 여기서 비로소 주문 접수 메일을 받는다.
      notifyOrderPlaced(supabase, {
        orderId: order.id,
        userId: order.user_id,
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? null,
        totalAmount: order.total_amount,
        shippingFee: order.shipping_fee ?? 0,
        paymentMethod: payment.method ?? null,
      }).catch(() => {})
      break
    }

    case 'WAITING_FOR_DEPOSIT': {
      // Virtual account issued but not yet deposited. confirm route 가 이미
      // VA 필드를 세팅했을 가능성이 높지만, 유저가 confirm을 거치지 않은
      // 엣지 케이스(탭 닫음)를 대비해 여기서도 업데이트 한 번 더.
      const va = payment.virtualAccount
      if (va) {
        // 규칙1 — { error } 를 꺼낸다. 실패해도 결정적 상태 전이가 아니라
        // (VA 안내 필드 보강일 뿐) 500 재시도 대신 기록만 남긴다.
        const vaUpd = await supabase
          .from('orders')
          .update({
            payment_method: payment.method ?? null,
            payment_key: paymentKey,
            virtual_account_bank: va.bankCode ?? null,
            virtual_account_number: va.accountNumber ?? null,
            virtual_account_due_date: va.dueDate ?? null,
            virtual_account_holder: va.customerName ?? null,
          })
          .eq('id', order.id)
        if (vaUpd.error) {
          captureBusinessEvent('warning', 'payment.webhook.va_update_failed', {
            orderId: order.id,
            paymentKey,
            dbError: String(vaUpd.error.message ?? 'unknown'),
          })
        }
      }
      break
    }

    case 'CANCELED':
    case 'PARTIAL_CANCELED': {
      // PARTIAL_CANCELED = 일부 환불이 일어났지만 나머지는 유효한 상태.
      // 이 플로우에서는 "전액 환불"만 지원하므로 PARTIAL을 'partially_refunded'
      // 라벨로 기록만 해두고 order_status 는 유지 (관리자가 수동 처리).
      if (order.payment_status === 'cancelled') {
        return NextResponse.json({ ok: true, skipped: 'already_cancelled' })
      }
      const isPartial = payment.status === 'PARTIAL_CANCELED'
      // 원자 전이 가드 — 다른 흐름(cancel 라우트/동시 웹훅)이 이미 payment_status
      // 를 바꿨으면 0-row 로 bail. 점검 fix: 이전엔 read-snapshot 가드(293)만 있어
      // cancel 라우트와 동시 진입 시 아래 recovery 의 쿠폰 회수가 이중 실행될 수
      // 있었다(다른 취소 경로는 모두 이 0-row 가드를 둠).
      const { data: cancelRows, error: cancelErr } = await supabase
        .from('orders')
        .update({
          payment_status: isPartial ? 'partially_refunded' : 'cancelled',
          order_status: isPartial ? order.order_status : 'cancelled',
          cancelled_at: isPartial ? null : new Date().toISOString(),
          cancel_reason: isPartial ? null : '결제 취소 (토스)',
        })
        .eq('id', order.id)
        .eq('payment_status', order.payment_status)
        .select('id')
      // ★ error 를 먼저 본다 — 오류와 '이미 처리됨'은 다르다(위 failAndAskRetry 주석).
      if (cancelErr) return await failAndAskRetry('orders.cancel', cancelErr)
      if (!cancelRows || cancelRows.length === 0) {
        // 0행 = 다른 흐름(취소 라우트 등)이 먼저 처리했다. 정상 skip.
        return NextResponse.json({ ok: true, skipped: 'already_processed' })
      }

      // R82-G2: payment_events ledger 기록 — 이전 코드 (R81 audit 발견) 가
      // Toss 대시보드에서 직접 환불한 케이스의 ledger event 미기록 →
      // reconcile cron 이 mismatch 잡지만 영구 false positive.
      // 부분 환불은 cancel_amount 정확값 추출이 어려워 metadata 만 기록,
      // 전액은 -total_amount 금액으로 ledger 잔액 0 으로 정합.
      {
        // TossPayment 타입에 cancels 없으나 실제 API 응답엔 포함 (PARTIAL_CANCELED 케이스)
        const tossCancels = (payment as unknown as {
          cancels?: Array<{ cancelAmount: number }>
        }).cancels
        // ★cancels 는 시간순 누적 배열 — **이번 전이의 금액은 마지막 원소**다.
        //   [0](최초 취소)을 읽으면 부분환불 2회째부터 항상 첫 금액이 기록되고,
        //   부분환불 뒤 전액취소를 -total_amount 로 적으면 이미 원장에 있는
        //   부분환불과 합쳐 과대 기록된다(2026-08-11 go-live 감사). 전액취소도
        //   마지막 취소 건 = 남은 잔액이라 그걸 쓴다(없으면 total 폴백).
        const latestCancel = tossCancels?.[tossCancels.length - 1]
        const cancelAmt = isPartial
          ? (latestCancel?.cancelAmount ?? 0)
          : (latestCancel?.cancelAmount ?? order.total_amount)
        const { recordPaymentEvent } = await import('@/lib/payment-events')
        await recordPaymentEvent(supabase, {
          orderId: order.id,
          paymentKey,
          eventType: isPartial ? 'partial_refunded' : 'refunded',
          amount: -cancelAmt,
          prevStatus: order.payment_status,
          newStatus: isPartial ? 'partially_refunded' : 'cancelled',
          source: 'toss_webhook',
          metadata: {
            tossStatus: payment.status,
            cancels: tossCancels ?? null,
          },
        })
      }

      // 포인트/쿠폰 복구 제거 (2026-07-16 포인트 전면 폐기 · 쿠폰은 자동할인 대체).
      // 복구할 사용자 자산이 없다 — 환불 자체(재고·상태·메일)는 그대로.

      // 전액 취소일 때만 고객 메일을 보냄 — 부분 환불은 ops 가 별도 커뮤니케이션.
      if (!isPartial) {
        notifyOrderCancelled(supabase, {
          orderId: order.id,
          userId: order.user_id,
          orderNumber: order.order_number,
          recipientName: order.recipient_name ?? null,
          totalAmount: order.total_amount,
          reason: '결제 취소 (토스)',
          refundAmount: order.total_amount,
        }).catch(() => {})
      }
      break
    }

    case 'ABORTED':
    case 'EXPIRED': {
      if (order.payment_status === 'failed') {
        return NextResponse.json({ ok: true, skipped: 'already_failed' })
      }
      const prevStatus = order.payment_status
      const failedUpd = await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
      if (failedUpd.error)
        return await failAndAskRetry('orders.failed', failedUpd.error)
      // R60 결제 원장 (payment_events) — 실패 이벤트도 insert-only ledger 에
      // 기록. 환불/조정 시 어떤 결제가 어떤 사유로 실패했는지 reconciliation
      // 가능. amount=0 (실패라 금전 이동 X).
      const { recordPaymentEvent } = await import('@/lib/payment-events')
      await recordPaymentEvent(supabase, {
        orderId: order.id,
        paymentKey,
        eventType: 'failed',
        amount: 0,
        prevStatus,
        newStatus: 'failed',
        source: 'toss_webhook',
        metadata: {
          toss_status: payment.status,
          reason: payment.status === 'ABORTED' ? '사용자 중단' : '결제 만료',
        },
      })
      break
    }

    default:
      // READY / IN_PROGRESS — transitional states, nothing to persist.
      break
  }

  return NextResponse.json({ ok: true })
}
