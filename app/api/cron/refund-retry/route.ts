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
 * # backoff — ✅ 시간 단위로 산다 (2026-08-11 Vercel Pro 원복)
 *   크론이 **매시간**(vercel.json: 매시 :30)이라, next_retry_at 이 지난 건을
 *   다음 정시에 재시도한다. 5분·15분 단계는 최대 ~1시간 내로, 1시간·6시간
 *   단계는 거의 표대로 실효화된다:
 *     5분 → 15분 → 1시간 → 6시간 → permanently_failed  (5회 소진 ~반나절)
 *
 *   (2026-07-19~08-11 Hobby 제약으로 하루 1회였고 실효 4~5일이었다. Pro 로
 *    매시간 원복. 분 단위 인터벌 크론은 cron-watchdog 이 파싱 못 해 매시간이 상한.)
 *
 * # 멱등성
 *   cancelPayment 의 idempotencyKey 가 payment_key + amount + reason 조합이라
 *   같은 row 를 N번 재시도해도 Toss 가 같은 응답 반환 → 중복 환불 X.
 *
 * # 스케줄 — **매시간** (vercel.json: `"30 * * * *"` = 매시 :30, 2026-08-11 Pro 원복)
 *   하루 1회면 backoff 가 전부 ~24시간이 된다. 매시간으로 올려 시간 단위로 산다.
 *   audit 규칙7 의 FREQUENT_ALLOWED 에 예외로 등록돼 있다.
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
  let deferred = 0
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
      // 보류도 세어 응답에 남긴다 — 안 세면 processed 와 합이 어긋나고,
      // 같은 행이 매일 보류돼도 신호가 없다.
      deferred += 1
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
      // ★사유에 재시도 횟수를 넣지 않는다(2026-08-05).
      //   토스 취소 멱등키는 `cancel:{paymentKey}:{amount}:{사유앞200자}` 라
      //   사유가 바뀌면 **키가 바뀐다** — 즉 시도마다 새 키였다. 이 파일 상단
      //   주석은 "같은 row 를 N번 재시도해도 토스가 같은 응답 → 중복 환불 X"
      //   라고 단언하는데 실물이 반대였다(규칙4).
      //   지금 큐에 들어오는 금액이 전부 전액이라 잔액 0 으로 토스가 거절해
      //   우연히 살아 있었을 뿐, 부분 금액 행이 하나 생기면 중복 환불이다.
      //   횟수는 로그·큐 행에 남으니 사유에서 뺀다.
      cancelReason: `자동 환불 (${row.reason})`,
      cancelAmount: row.amount,
    })

    if (result.ok) {
      await settleRefunded(adminTyped, row, attempts, null)
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
      // ★여기도 같은 마무리를 한다(2026-08-05 재감사).
      //   전에는 큐만 닫고 끝나서, cancelled_mid_charge 행은 주문이 'paid' 로
      //   남고 원장엔 +금액만 있어 **reconcile 이 정합으로 읽었다**. 도장
      //   회수 트리거도 안 돌아 환불된 결제로 도장이 남았다.
      //   타임아웃 1번이면 이 분기에 도달한다(2차 실행에서 토스가
      //   ALREADY_CANCELED 를 준다) — 드문 경로가 아니다.
      await settleRefunded(adminTyped, row, attempts, `toss_already_settled:${errCode}`)
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
    deferred,
    succeeded,
    retried,
    failed,
  })
}

/**
 * 환불이 확정된 뒤의 마무리 — **장부 먼저, 큐 마감 마지막**.
 *
 * 순서가 중요하다. 전에는 큐를 먼저 succeeded 로 닫고 orders·원장을 나중에
 * 썼는데, 그 사이에 함수가 죽으면 **큐는 닫혔는데 장부는 빈다**(다시 잡을
 * 방법이 없다). 반대 순서면 중간에 죽어도 큐가 열려 있어 다음 실행이 이어받고,
 * 토스는 같은 멱등키로 같은 응답을 돌려준다.
 *
 * 두 성공 분기(정상 환불 · 토스가 이미 처리함)가 **같은 마무리를 공유**한다 —
 * 한쪽만 고쳐서 장부가 갈라졌던 게 2026-08-05 재감사의 발견이었다.
 */
async function settleRefunded(
  admin: ReturnType<typeof createAdminClient>,
  row: { id: string; order_id: string; payment_key: string; amount: number },
  attempts: number,
  lastError: string | null,
): Promise<void> {
  const { error: ordErr } = await admin
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
  const ev = await recordPaymentEvent(admin as never, {
    orderId: row.order_id,
    paymentKey: row.payment_key,
    eventType: 'cron_refund_queue',
    amount: -row.amount, // 음수 = 환불(SUM = 현재 잔액)
    source: 'cron_refund_queue',
  })
  // 반환값을 버리면 원장 누락이 조용히 지나가고, 주간 대사에서 익명
  // mismatch 로만 드러난다 — 그때는 원인을 못 찾는다.
  if (!ev.ok) {
    captureBusinessEvent('error', 'refund.queue.ledger_write_failed', {
      orderId: row.order_id,
      amount: row.amount,
      reason: ev.reason ?? 'unknown',
    })
  }

  // 마지막에 큐를 닫는다.
  await admin
    .from('payment_refund_queue')
    .update({ status: 'succeeded', attempts, last_error: lastError })
    .eq('id', row.id)
}
