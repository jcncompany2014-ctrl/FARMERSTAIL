import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { chargeBillingKey } from '@/lib/payments/toss'
import { notifySubscriptionChargeFailed } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-charge
 *
 * 매일 새벽 (KST 04:00 권장) 실행. 다음 조건의 구독을 자동 결제:
 *   - status = 'active'
 *   - next_delivery_date = 오늘 (KST)
 *   - billing_key IS NOT NULL
 *   - 같은 (subscription_id, today) 로 subscription_charges 에 row 가 없음
 *     (멱등 — 같은 날 두 번 결제 안 됨)
 *
 * 처리 흐름:
 *   1) 대상 구독 select
 *   2) 각 구독에 대해 charge attempt:
 *      a. subscription_charges row insert (status='pending', UNIQUE 충돌 시 skip)
 *      b. orders row insert (status='pending', payment_status='pending')
 *      c. Toss billingKey 청구
 *      d. 성공 → orders/charge update + subscriptions.next_delivery_date 갱신
 *      e. 실패 → failed_charge_count += 1, 3회 누적 시 status='paused'
 *   3) 결과 집계 반환
 *
 * 보안: CRON_SECRET bearer.
 *
 * # 시간대
 * - vercel.json cron 은 UTC. KST 04:00 = UTC 19:00 → "0 19 * * *"
 *
 * # 가드레일
 * - 한 번에 100건 까지만 처리 (대량 큐 폭주 방지). 다음 cron 에서 계속.
 * - 결제 호출 사이에 100ms 딜레이 (Toss QPS 한도 보호).
 */

type SubscriptionRow = {
  id: string
  user_id: string
  next_delivery_date: string
  total_amount: number
  billing_key: string
  billing_customer_key: string
  failed_charge_count: number
  recipient_name: string | null
  recipient_phone: string | null
  recipient_zip: string | null
  recipient_address: string | null
  recipient_address_detail: string | null
  interval_weeks: number
  total_deliveries: number
}

const MAX_PER_RUN = 100
const MAX_FAILED = 3

function todayKstIsoDate(): string {
  // KST = UTC+9. 단순 계산: 현재 UTC 에 9h 더해서 date 부분만.
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function addWeeksIso(isoDate: string, weeks: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const today = todayKstIsoDate()

  // 1) 오늘 결제 대상 구독 fetch — 누락된 billing_key / paused 는 자동 제외.
  const { data: subs, error: fetchErr } = await supabase
    .from('subscriptions')
    .select(
      `id, user_id, next_delivery_date, total_amount,
       billing_key, billing_customer_key, failed_charge_count,
       recipient_name, recipient_phone, recipient_zip, recipient_address,
       recipient_address_detail, interval_weeks, total_deliveries`,
    )
    .eq('status', 'active')
    .not('billing_key', 'is', null)
    .lte('next_delivery_date', today)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  const targets = (subs ?? []) as SubscriptionRow[]
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const sub of targets) {
    // 2-a) charge row insert. UNIQUE (subscription_id, scheduled_for) 충돌 시
    //      이미 처리됨 — skip.
    const { data: chargeRow, error: chargeErr } = await supabase
      .from('subscription_charges')
      .insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        scheduled_for: today,
        status: 'pending',
        amount: sub.total_amount,
      })
      .select('id')
      .single()

    if (chargeErr) {
      // 23505 = unique violation = 이미 같은 날 시도함. 정상 skip.
      if (
        (chargeErr as unknown as { code?: string }).code === '23505'
      ) {
        skipped += 1
        continue
      }
      failed += 1
      continue
    }

    // 2-b) order row 먼저 만든다 (payment_status='pending'). orderId 가 Toss
    //      청구 요청에 필요. user 가 직접 결제한 주문과 구분되도록 source 컬럼
    //      이 있다면 'subscription' 마킹 권장 (없으면 일반 주문과 동일 처리).
    const orderName = `Farmer's Tail 정기배송 #${sub.total_deliveries + 1}`
    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: sub.user_id,
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: sub.total_amount,
        recipient_name: sub.recipient_name,
        recipient_phone: sub.recipient_phone,
        recipient_zip: sub.recipient_zip,
        recipient_address: sub.recipient_address,
        recipient_address_detail: sub.recipient_address_detail,
      })
      .select('id, order_number')
      .single()

    if (orderErr || !orderRow) {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'ORDER_INSERT_FAILED',
          error_message: orderErr?.message ?? 'unknown',
          completed_at: new Date().toISOString(),
        })
        .eq('id', chargeRow.id)
      failed += 1
      continue
    }

    // 2-c) Toss 청구.
    const result = await chargeBillingKey({
      billingKey: sub.billing_key,
      customerKey: sub.billing_customer_key,
      orderId: orderRow.id,
      orderName,
      amount: sub.total_amount,
      idempotencyKey: `sub-charge:${sub.id}:${today}`,
    })

    if (result.ok) {
      // 2-d) 성공 → orders / charge / subscription 업데이트.
      const nowIso = new Date().toISOString()
      const nextDate = addWeeksIso(today, sub.interval_weeks)
      await Promise.all([
        supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'preparing',
            payment_key: result.paymentKey,
            paid_at: nowIso,
          })
          .eq('id', orderRow.id),
        supabase
          .from('subscription_charges')
          .update({
            status: 'succeeded',
            payment_key: result.paymentKey,
            order_id: orderRow.id,
            completed_at: nowIso,
          })
          .eq('id', chargeRow.id),
        supabase
          .from('subscriptions')
          .update({
            next_delivery_date: nextDate,
            last_charged_at: nowIso,
            failed_charge_count: 0,
            total_deliveries: sub.total_deliveries + 1,
          })
          .eq('id', sub.id),
      ])
      succeeded += 1
    } else {
      // 2-e) 실패 → counter 증가. 3회 누적이면 paused.
      const nextFailedCount = sub.failed_charge_count + 1
      const shouldPause = nextFailedCount >= MAX_FAILED
      const nowIso = new Date().toISOString()
      await Promise.all([
        supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            cancel_reason: result.error?.message ?? '결제 실패',
            cancelled_at: nowIso,
          })
          .eq('id', orderRow.id),
        supabase
          .from('subscription_charges')
          .update({
            status: 'failed',
            error_code: result.error?.code,
            error_message: result.error?.message,
            completed_at: nowIso,
          })
          .eq('id', chargeRow.id),
        supabase
          .from('subscriptions')
          .update({
            failed_charge_count: nextFailedCount,
            last_failed_charge_at: nowIso,
            last_failed_charge_reason: result.error?.message ?? null,
            ...(shouldPause ? { status: 'paused' } : {}),
          })
          .eq('id', sub.id),
      ])
      failed += 1

      // 사용자에게 결제 실패 이메일 발송 — fire-and-forget. 메일 발송 실패가
      // cron 흐름을 막아서는 안 됨. profiles 와 subscription_items 에서
      // recipient + 상품명 조회 후 발송.
      void (async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', sub.user_id)
            .maybeSingle()
          if (!profile?.email) return
          const { data: items } = await supabase
            .from('subscription_items')
            .select('product_name, quantity')
            .eq('subscription_id', sub.id)
            .limit(2)
          const itemsArr = (items ?? []) as { product_name: string; quantity: number }[]
          const productLabel =
            itemsArr.length === 0
              ? '정기배송 상품'
              : itemsArr.length === 1
                ? itemsArr[0].product_name
                : `${itemsArr[0].product_name} 외 ${itemsArr.length - 1}개`
          await notifySubscriptionChargeFailed({
            email: profile.email,
            name: profile.name ?? null,
            subscriptionId: sub.id,
            productLabel,
            amount: sub.total_amount,
            attemptCount: nextFailedCount,
            paused: shouldPause,
            reason: result.error?.message ?? null,
            scheduledFor: today,
          })
        } catch {
          /* swallow — 다음 cron 시 재발송 idempotencyKey 가 차단 */
        }
      })()
    }

    // QPS 보호 — Toss 분당 제한 안 넘게 100ms 간격.
    await new Promise((r) => setTimeout(r, 100))
  }

  return NextResponse.json({
    ok: true,
    today,
    checked: targets.length,
    succeeded,
    failed,
    skipped,
  })
}
