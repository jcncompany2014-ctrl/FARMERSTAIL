import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { chargeBillingKey } from '@/lib/payments/toss'
import {
  classifyBillingError,
  describeBillingError,
  RETRY_COOLDOWN_MS,
} from '@/lib/payments/billing-error-classify'
import { notifySubscriptionChargeFailed } from '@/lib/email'
import { pushToUser } from '@/lib/push'
import { traceBusiness, captureBusinessEvent } from '@/lib/sentry/trace'
import { trackCron } from '@/lib/cron-tracking'

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
  coverage_weeks: number | null
  dog_id: string | null
  total_deliveries: number
  next_retry_at: string | null
  requires_billing_key_renewal: boolean | null
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

/**
 * 박스 정기배송 (dog_id + coverage_weeks 있음) 은 캘린더 월 기준 — 같은 날
 * 다음 달. order 페이지 cycleDays (4주치=30일, 2주치=15일) 와 정합. 단일
 * SKU /subscribe/[slug] 흐름 (interval_weeks 1/2/4) 은 기존 weekly 로직 유지.
 */
function nextDeliveryDate(sub: SubscriptionRow, todayIso: string): string {
  const isBoxSubscription = !!sub.dog_id && sub.coverage_weeks != null
  if (isBoxSubscription) {
    const d = new Date(todayIso + 'T00:00:00Z')
    if (sub.coverage_weeks === 2) {
      // 2주치 하이브리드 — 15일 후
      d.setUTCDate(d.getUTCDate() + 15)
    } else {
      // 4주치 풀 — 캘린더 월 (같은 날 다음 달)
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
    return d.toISOString().slice(0, 10)
  }
  return addWeeksIso(todayIso, sub.interval_weeks)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('subscription-charge', () => runSubscriptionCharge())
}

async function runSubscriptionCharge(): Promise<Response> {
  const supabase = createAdminClient()
  const today = todayKstIsoDate()

  // 1) 오늘 결제 대상 구독 fetch.
  //    제외 조건:
  //      - status != active
  //      - billing_key NULL (등록 안 됨)
  //      - requires_billing_key_renewal=true (영구 거절 — 사용자가 카드 다시
  //        등록할 때까지 대기)
  //      - next_retry_at > NOW() (transient 실패 후 24h 쿨다운 중)
  const nowIso = new Date().toISOString()
  const { data: subs, error: fetchErr } = await supabase
    .from('subscriptions')
    .select(
      `id, user_id, next_delivery_date, total_amount,
       billing_key, billing_customer_key, failed_charge_count,
       recipient_name, recipient_phone, recipient_zip, recipient_address,
       recipient_address_detail, interval_weeks, coverage_weeks, dog_id,
       total_deliveries, next_retry_at, requires_billing_key_renewal`,
    )
    .eq('status', 'active')
    .eq('requires_billing_key_renewal', false)
    .not('billing_key', 'is', null)
    .lte('next_delivery_date', today)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
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

    // 2-b-2) subscription_items → order_items 복사 (audit fix).
    // 이전: order row 만 만들고 items 누락 → 사용자/admin 이 주문 상세에서
    // 상품 안 보임 + 발송 운영 시 어떤 상품 보낼지 모름.
    const { data: subItems } = await supabase
      .from('subscription_items')
      .select('product_id, product_name, product_image_url, quantity, unit_price')
      .eq('subscription_id', sub.id)
    const subItemsArr = (subItems ?? []) as Array<{
      product_id: string | null
      product_name: string
      product_image_url: string | null
      quantity: number
      unit_price: number
    }>
    if (subItemsArr.length > 0) {
      await supabase.from('order_items').insert(
        subItemsArr.map((it) => ({
          order_id: orderRow.id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_image_url: it.product_image_url,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.unit_price * it.quantity,
        })),
      )
    }

    // 2-c) Toss 청구. 비즈니스 span 으로 wrap — Sentry 트랜잭션에서 실패율 +
    //      latency 추적.
    const result = await traceBusiness(
      'subscription.charge',
      {
        'subscription.id': sub.id,
        'subscription.amount': sub.total_amount,
        'subscription.failed_count': sub.failed_charge_count,
        'subscription.scheduled_for': today,
      },
      () =>
        chargeBillingKey({
          billingKey: sub.billing_key,
          customerKey: sub.billing_customer_key,
          orderId: orderRow.id,
          orderName,
          amount: sub.total_amount,
          idempotencyKey: `sub-charge:${sub.id}:${today}`,
        }),
    )

    if (result.ok) {
      // 2-d) 성공 → orders / charge / subscription 업데이트.
      // 성공하면 모든 retry/renewal 플래그를 0/false 로 reset (이전에 실패해서
      // 카드 재등록 받은 후 정상화 케이스 포함).
      const successIso = new Date().toISOString()
      const nextDate = nextDeliveryDate(sub, today)
      await Promise.all([
        supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'preparing',
            payment_key: result.paymentKey,
            paid_at: successIso,
          })
          .eq('id', orderRow.id),
        supabase
          .from('subscription_charges')
          .update({
            status: 'succeeded',
            payment_key: result.paymentKey,
            order_id: orderRow.id,
            completed_at: successIso,
          })
          .eq('id', chargeRow.id),
        supabase
          .from('subscriptions')
          .update({
            next_delivery_date: nextDate,
            last_charged_at: successIso,
            failed_charge_count: 0,
            next_retry_at: null,
            last_failed_charge_at: null,
            last_failed_charge_reason: null,
            last_failed_charge_code: null,
            requires_billing_key_renewal: false,
            total_deliveries: sub.total_deliveries + 1,
          })
          .eq('id', sub.id),
      ])
      captureBusinessEvent('info', 'subscription.charge.succeeded', {
        subscriptionId: sub.id,
        amount: sub.total_amount,
        attemptCount: sub.failed_charge_count + 1,
      })
      succeeded += 1
    } else {
      // 2-e) 실패 → 에러 코드 분류해서 분기.
      //
      // permanent (카드 만료/유효 X): 즉시 paused + requires_billing_key_renewal.
      //   재시도 의미 없음. 사용자가 카드 다시 등록할 때까지 대기.
      // transient (잔액부족/네트워크): count 증가 안 함, next_retry_at +24h.
      //   같은 카드로 시간 지나면 풀릴 가능성.
      // unknown: 기존 3-strike 정책 — count++, 3회면 paused.
      const errorCode = result.error?.code ?? null
      const errorClass = classifyBillingError(errorCode)
      const nowIso2 = new Date().toISOString()

      let shouldPause = false
      let shouldMarkRenewal = false
      let nextFailedCount = sub.failed_charge_count
      let nextRetryAt: string | null = null
      const reasonShort = describeBillingError(errorCode).short

      if (errorClass === 'permanent') {
        shouldPause = true
        shouldMarkRenewal = true
        // permanent 는 count 증가 의미 없음 — 1회 카운트만 찍어 history 보전.
        nextFailedCount = sub.failed_charge_count + 1
      } else if (errorClass === 'transient') {
        // count 증가 안 함 — 사용자가 같은 카드로 시간 지나면 결제 가능.
        nextRetryAt = new Date(Date.now() + RETRY_COOLDOWN_MS).toISOString()
      } else {
        // unknown: 기존 3-strike.
        nextFailedCount = sub.failed_charge_count + 1
        shouldPause = nextFailedCount >= MAX_FAILED
      }

      const subUpdate: Record<string, unknown> = {
        failed_charge_count: nextFailedCount,
        last_failed_charge_at: nowIso2,
        last_failed_charge_code: errorCode,
        last_failed_charge_reason: result.error?.message ?? reasonShort,
        next_retry_at: nextRetryAt,
      }
      if (shouldPause) subUpdate.status = 'paused'
      if (shouldMarkRenewal) subUpdate.requires_billing_key_renewal = true

      await Promise.all([
        supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            cancel_reason: result.error?.message ?? '결제 실패',
            cancelled_at: nowIso2,
          })
          .eq('id', orderRow.id),
        supabase
          .from('subscription_charges')
          .update({
            status: 'failed',
            error_code: errorCode,
            error_message: result.error?.message,
            completed_at: nowIso2,
          })
          .eq('id', chargeRow.id),
        supabase.from('subscriptions').update(subUpdate).eq('id', sub.id),
      ])

      // 매출 영향 이벤트 — Sentry breadcrumb 분류 가능하게 errorClass 같이 기록.
      captureBusinessEvent(
        shouldPause ? 'warning' : 'info',
        shouldMarkRenewal
          ? 'subscription.charge.renewal_required'
          : shouldPause
            ? 'subscription.charge.paused'
            : errorClass === 'transient'
              ? 'subscription.charge.transient'
              : 'subscription.charge.failed',
        {
          subscriptionId: sub.id,
          amount: sub.total_amount,
          attemptCount: nextFailedCount,
          errorCode,
          errorClass,
        },
      )
      failed += 1

      // 푸시 알림 — order 카테고리 (push_preferences + quiet hours 자동 검사).
      // 이메일과 별개로 push ON 사용자에게도 닿게. permanent / transient /
      // unknown 별로 톤 다르게.
      const pushTitle = shouldMarkRenewal
        ? '카드 정보를 다시 등록해주세요 💳'
        : shouldPause
          ? '정기배송이 일시중단됐어요'
          : errorClass === 'transient'
            ? '결제가 잠시 실패 — 내일 다시 시도할게요'
            : '정기배송 결제 실패'
      const pushBody = shouldMarkRenewal
        ? `${reasonShort} · 마이페이지에서 새 카드 등록`
        : shouldPause
          ? '연속 3회 실패. 마이페이지에서 카드 확인'
          : reasonShort
      pushToUser(
        sub.user_id,
        {
          title: pushTitle,
          body: pushBody,
          url: '/mypage/subscriptions',
          tag: `sub-charge-failed-${sub.id}-${today}`,
          requireInteraction: shouldMarkRenewal,
        },
        { category: 'order' },
      ).catch(() => {})

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
            reason: result.error?.message ?? reasonShort,
            scheduledFor: today,
            errorClass,
            nextRetryAt,
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
