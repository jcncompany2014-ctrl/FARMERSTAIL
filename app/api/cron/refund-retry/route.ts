import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { cancelPayment } from '@/lib/payments/toss'
import { captureBusinessEvent } from '@/lib/sentry/trace'
// R91-D #1 (D7): 환불 영구 실패 시 운영자 수동 개입 필수 → fatal alert helper
// 로 Sentry rule 라우팅 가능하게.
import { alertRefundFailure } from '@/lib/sentry/alerts'
// 점검 I: Toss 에러메시지(카드/계좌 PII·제어문자 가능)를 Sentry/Slack/DB last_error
// 로 보내기 전 마스킹.
import { sanitizeLogText } from '@/lib/log-sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refund-retry
 *
 * audit 2-2 의 payment_refund_queue 재시도 워커.
 *
 * # 흐름
 *   1) status='pending' AND next_retry_at <= now() row N개 픽업 (FIFO).
 *   2) 각 row 에 대해 cancelPayment 호출.
 *      - 성공 → status='succeeded' + updated_at 갱신
 *      - 실패 → attempts++ + last_error 기록 + next_retry_at = exponential backoff
 *      - attempts >= MAX_ATTEMPTS → status='permanently_failed' + Sentry alert
 *
 * # backoff — **지금은 표대로 안 돈다** (2026-07-31 주석 정정)
 *   코드가 넣는 `next_retry_at` 은 아래 간격이지만, **크론이 하루 1회**라
 *   (vercel.json: `"30 19 * * *"` = KST 04:30) 그 시각이 지났는지와 무관하게
 *   **다음 실행은 다음 날**이다. 즉 실효 간격은 전부 ~24시간이다.
 *     코드값:  5분 → 15분 → 1시간 → 6시간 → permanently_failed
 *     실효:    ~24h → ~24h → ~24h → ~24h  (= 5회 소진에 **약 4~5일**)
 *
 *   ⚠️ 고객 입장에서 이 말은 **환불이 한 번 실패하면 최소 하루를 기다린다**는
 *      뜻이다. 표만 보고 "몇 시간이면 끝난다" 고 안내하면 안 된다.
 *
 *   왜 하루 1회인가: Vercel Hobby 는 하루 1회 크론만 허용한다. 넘기면 **빌드
 *   시작 자체를 거부**한다(AGENTS.md 규칙7 — 실제로 38시간 배포가 멈춘 적 있다).
 *   Pro 업그레이드 시 vercel.json 의 이 크론을 잦게 되돌리면 위 표가 살아난다 —
 *   출시 체크리스트 항목이다. **코드는 안 고쳐도 된다**(간격은 이미 짧게 박혀 있다).
 *
 * # 멱등성
 *   cancelPayment 의 idempotencyKey 가 payment_key + amount + reason 조합이라
 *   같은 row 를 N번 재시도해도 Toss 가 같은 응답 반환 → 중복 환불 X.
 *
 * # 스케줄 — **하루 1회** (vercel.json: `"30 19 * * *"` = KST 04:30)
 *   "15분 간격으로 시작" 이라고 적혀 있었으나 사실이 아니다(2026-07-31 정정).
 *   Vercel Hobby 는 하루 1회 크론만 허용하고, 넘기면 빌드가 아예 거부된다.
 *   Pro 업그레이드 시 여기를 잦게 되돌리는 것이 출시 체크리스트 항목이다.
 *
 * # 보안
 *   isAuthorizedCronRequest 통과 후 service_role 로 row 잡고 update.
 */

const MAX_ATTEMPTS = 5
const MAX_PER_RUN = 50
const BACKOFF_MS = [
  5 * 60_000, // 5분
  15 * 60_000, // 15분
  60 * 60_000, // 1시간
  6 * 60 * 60_000, // 6시간
]

type RefundRow = {
  id: string
  order_id: string
  payment_key: string
  amount: number
  reason: string
  attempts: number
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('refund-retry', () => runRefundRetry())
}

async function runRefundRetry(): Promise<Response> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  // 1) pending row 픽업. Postgres types 가 아직 payment_refund_queue 모름 →
  //    cast 우회. apply_migration 이후 generate types 새로 돌리면 캐스트 제거 가능.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTyped = supabase as any
  const { data: rows, error: pickErr } = (await adminTyped
    .from('payment_refund_queue')
    .select('id, order_id, payment_key, amount, reason, attempts')
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(MAX_PER_RUN)) as {
    data: RefundRow[] | null
    error: { message: string } | null
  }

  if (pickErr) {
    return NextResponse.json(
      { ok: false, reason: 'pick_failed', error: pickErr.message },
      { status: 500 },
    )
  }

  const queue = rows ?? []
  if (queue.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, succeeded: 0, retried: 0, failed: 0 })
  }

  let succeeded = 0
  let retried = 0
  let failed = 0

  for (const row of queue) {
    const attempts = row.attempts + 1

    // ── pre-flight: 주문이 그 사이 다시 paid 상태로 회복됐는지 확인 ──
    // 사용자가 결제 페이지 새로고침 → 두 번째 confirm 호출이 idempotent 하게
    // 성공 → orders.payment_status = 'paid' 가 됐을 수 있다. 그 경우 환불
    // 시도 자체가 잘못된 false negative (실제론 정상 주문). queue row 만
    // succeeded 로 마무리하고 cancel 호출은 skip.
    const { data: orderRow, error: orderRowErr } = (await adminTyped
      .from('orders')
      .select('payment_status')
      .eq('id', row.order_id)
      .maybeSingle()) as {
      data: { payment_status: string | null } | null
      error: { message: string } | null
    }
    // ★조회 실패면 이 행을 **건드리지 않고** 다음 실행에 맡긴다(2026-08-05).
    //   실패를 'paid 아님'으로 읽고 pre-flight 없이 환불로 직행하면, confirm
    //   회복 케이스에서 정상 주문을 환불하는 반대 사고가 난다. attempts 도
    //   올리지 않는다 — 우리 쪽 조회 실패는 재시도 소진 사유가 아니다.
    if (orderRowErr) {
      console.error('[refund-retry] pre-flight 조회 실패, 보류:', orderRowErr.message)
      continue
    }

    // ★pre-flight 는 confirm 이중호출 회복(reason: confirm 실패류) 전용이다
    //   (2026-08-05 병렬 감사 — 두 크론이 'paid' 를 정반대 의미로 쓰고 있었다).
    //   cancelled_mid_charge 는 **의도적으로** 주문을 'paid' 로 남긴다: "돈은
    //   캡처됐고 환불은 큐가 책임진다"는 표시다. 그걸 '회복됨'으로 읽으면
    //   토스는 돈을 갖고, 고객은 해지했고, 박스는 안 나가고, 환불은 영영
    //   재시도되지 않는다 — 원장 reconcile 도 orders paid = ledger +amount 로
    //   일치라서 못 잡는 완전한 소멸 경로였다.
    if (
      orderRow?.payment_status === 'paid' &&
      row.reason !== 'cancelled_mid_charge'
    ) {
      await adminTyped
        .from('payment_refund_queue')
        .update({
          status: 'succeeded',
          attempts,
          last_error: 'order_recovered_paid',
        })
        .eq('id', row.id)
      succeeded += 1
      continue
    }

    // Toss cancelPayment — idempotencyKey 내부 처리. 같은 paymentKey/amount 로
    // 두 번 보내도 Toss 는 첫 결과 그대로 반환.
    const result = await cancelPayment({
      paymentKey: row.payment_key,
      cancelReason: `자동 환불 (${row.reason}) — 재시도 ${attempts}`,
      cancelAmount: row.amount,
    })

    if (result.ok) {
      await adminTyped
        .from('payment_refund_queue')
        .update({
          status: 'succeeded',
          attempts,
          last_error: null,
        })
        .eq('id', row.id)

      // ★환불했으면 주문과 장부에도 쓴다(2026-08-05 병렬 감사).
      //   예전엔 큐 한 줄만 갱신하고 끝나서, 토스 장부는 환불 완료인데 우리
      //   orders 는 'paid'/'pending' 그대로였다. 실제 돈 흐름 [캡처 +A,
      //   환불 −A] 중 어느 쪽도 남지 않아 주간 reconcile 이 성립하지 않는다.
      //   payment_events 에 'cron_refund_queue' 타입·소스가 **정의만 되고
      //   사용처가 0** 이었던 것도 배선하다 만 흔적이다.
      const { error: ordErr } = await adminTyped
        .from('orders')
        .update({
          payment_status: 'cancelled',
          order_status: 'cancelled',
          refunded_amount: row.amount,
        })
        .eq('id', row.order_id)
      if (ordErr) {
        // 환불은 이미 됐다 — 되돌릴 수 없으니 사람에게 알린다.
        captureBusinessEvent('error', 'refund.queue.order_update_failed', {
          orderId: row.order_id,
          amount: row.amount,
          note: '토스 환불은 성공했는데 orders 갱신 실패 — 수동 정정 필요',
        })
      }
      const { recordPaymentEvent } = await import('@/lib/payment-events')
      await recordPaymentEvent(adminTyped as never, {
        orderId: row.order_id,
        paymentKey: row.payment_key,
        eventType: 'cron_refund_queue',
        amount: -row.amount, // 음수 = 환불(SUM = 현재 잔액)
        source: 'cron_refund_queue',
      })

      succeeded += 1
      continue
    }

    // Toss "이미 취소/처리된 결제" 응답을 succeeded 로 매핑.
    // 코드 후보: ALREADY_PROCESSED_PAYMENT / ALREADY_CANCELED_PAYMENT /
    //   NOT_CANCELABLE_PAYMENT (이미 환불 완료) / NOT_FOUND_PAYMENT (사라짐) /
    //   ALREADY_REFUNDED_PAYMENT. Toss 가 idempotency 보장하지 않는 케이스라
    //   에러로 오지만 실제론 우리가 원하는 최종 상태.
    const errCode = (result.error.code ?? '').toUpperCase()
    const alreadySettled =
      errCode === 'ALREADY_PROCESSED_PAYMENT' ||
      errCode === 'ALREADY_CANCELED_PAYMENT' ||
      errCode === 'ALREADY_REFUNDED_PAYMENT' ||
      errCode === 'NOT_CANCELABLE_PAYMENT' ||
      errCode === 'NOT_FOUND_PAYMENT'
    if (alreadySettled) {
      await adminTyped
        .from('payment_refund_queue')
        .update({
          status: 'succeeded',
          attempts,
          last_error: `toss_already_settled:${errCode}`,
        })
        .eq('id', row.id)
      succeeded += 1
      continue
    }

    // 실패 — backoff 또는 permanently_failed.
    if (attempts >= MAX_ATTEMPTS) {
      await adminTyped
        .from('payment_refund_queue')
        .update({
          status: 'permanently_failed',
          attempts,
          last_error: sanitizeLogText(result.error.message),
        })
        .eq('id', row.id)
      captureBusinessEvent('error', 'refund_queue.permanent_failure', {
        orderId: row.order_id,
        paymentKey: row.payment_key,
        attempts,
        lastError: sanitizeLogText(result.error.message),
      })
      // R91-D #1: 운영자가 수동 환불 진행해야 함 → fatal alert.
      alertRefundFailure({
        orderId: row.order_id,
        attempts,
        lastError: sanitizeLogText(result.error.message),
      })
      failed += 1
      continue
    }

    // exponential backoff. attempts 가 1-indexed (방금 한 시도 횟수).
    const backoffIdx = Math.min(attempts - 1, BACKOFF_MS.length - 1)
    const nextRetryAt = new Date(Date.now() + BACKOFF_MS[backoffIdx]!).toISOString()
    await adminTyped
      .from('payment_refund_queue')
      .update({
        attempts,
        last_error: sanitizeLogText(result.error.message),
        next_retry_at: nextRetryAt,
      })
      .eq('id', row.id)
    retried += 1
  }

  return NextResponse.json({
    ok: true,
    processed: queue.length,
    succeeded,
    retried,
    failed,
  })
}
