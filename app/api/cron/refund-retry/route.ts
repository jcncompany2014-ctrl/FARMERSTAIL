import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { cancelPayment } from '@/lib/payments/toss'
import { captureBusinessEvent } from '@/lib/sentry/trace'

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
 * # backoff
 *   attempt 1 실패 → 5분 뒤
 *   attempt 2 실패 → 15분 뒤
 *   attempt 3 실패 → 1시간 뒤
 *   attempt 4 실패 → 6시간 뒤
 *   attempt 5 실패 → permanently_failed (운영자 수동 처리)
 *
 * # 멱등성
 *   cancelPayment 의 idempotencyKey 가 payment_key + amount + reason 조합이라
 *   같은 row 를 N번 재시도해도 Toss 가 같은 응답 반환 → 중복 환불 X.
 *
 * # 스케줄
 *   5분 간격이 이상적이지만 Vercel Hobby plan 은 cron 횟수 제한. 일단 15분
 *   간격으로 시작 (audit 후 안정성 확인되면 5분으로 조정).
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
          last_error: result.error.message,
        })
        .eq('id', row.id)
      captureBusinessEvent('error', 'refund_queue.permanent_failure', {
        orderId: row.order_id,
        paymentKey: row.payment_key,
        attempts,
        lastError: result.error.message,
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
        last_error: result.error.message,
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
