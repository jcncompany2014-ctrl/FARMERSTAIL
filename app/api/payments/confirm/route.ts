import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { creditPoints } from '@/lib/commerce/points'
import { confirmPayment, cancelPayment } from '@/lib/payments/toss'
import { notifyOrderPlaced, notifyVirtualAccountWaiting } from '@/lib/email'
import { zPaymentConfirm } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimitDB, ipFromRequest } from '@/lib/rate-limit'
import { tierMeta } from '@/lib/tiers'
// R91-D #1 (D7): 결제 위변조 / 금액 불일치 발생 시 즉시 fatal Sentry alert.
// captureBusinessEvent 만 호출하던 흐름을 alert helper 로 통일해서
// business.alert.kind 태그가 박혀 Sentry rule 가 라우팅 가능.
import { alertAmountMismatch, alertFraud } from '@/lib/sentry/alerts'
import {
  traceBusiness,
  captureBusinessEvent,
  tagSentryUser,
  tagSentryRoute,
} from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/confirm
 *
 * 체크아웃 successUrl로 리다이렉트된 직후 호출. 역할:
 *   1. 주문과 paymentKey/amount 일치성 검증(위변조 방지).
 *   2. Toss v1 `/payments/confirm` 호출 (Idempotency-Key 사용 — 같은 요청 반복 시
 *      Toss가 동일 응답을 돌려주므로 새로고침/이중 탭 공격에도 안전).
 *   3. 응답의 status가 DONE이면 paid/preparing으로, WAITING_FOR_DEPOSIT이면
 *      pending으로 유지하며 가상계좌 정보(은행·계좌번호·만료일) 저장.
 *   4. DONE일 때만 포인트 적립. 가상계좌는 입금 확정 시점의 웹훅에서 별도 처리.
 *
 * # 보호
 * - Zod schema (paymentKey/orderId 길이, amount 양의 정수)
 * - Rate limit: IP 당 10/min (정상 결제 흐름 + 새로고침 1-2회 여유)
 */
export async function POST(req: Request) {
  // Rate limit — payment 위조 시도 / 무한 재시도 방어. audit 1-9: DB 백업
  // (Vercel isolate 분산 시 in-memory 만으로는 한도가 quota × N 으로 뻥튀기).
  const parsed = await parseRequest(req, zPaymentConfirm)
  if (!parsed.ok) return parsed.response
  const { paymentKey, orderId, amount } = parsed.data

  const supabase = await createClient()
  const rl = await rateLimitDB({
    supabase,
    bucket: 'payments-confirm',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  // Sentry — user.id + route 도메인 태깅 (PII 미포함, id 만).
  tagSentryRoute('order.payment.confirm')
  await tagSentryUser(supabase)

  // 1) 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 }
    )
  }

  // 2) 주문 검증 (DB 기준)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, payment_status, user_id, points_earned, points_used, discount_amount, shipping_fee, subtotal, recipient_name'
    )
    .eq('order_number', orderId)
    .eq('user_id', user.id)
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없어요' },
      { status: 404 }
    )
  }

  if (order.total_amount !== amount) {
    // R91-D #1: fatal alert — Sentry rule 가 business.alert.kind='amount_mismatch'
    // 로 즉시 Slack/email 라우팅 가능. 클라이언트가 임의 amount 로 confirm 시도.
    alertAmountMismatch({
      orderId: order.id,
      expected: order.total_amount,
      actual: amount,
    })
    return NextResponse.json(
      { code: 'AMOUNT_MISMATCH', message: '결제 금액이 맞지 않아요' },
      { status: 400 }
    )
  }

  // 이미 승인된 경우 idempotent하게 성공 응답
  if (order.payment_status === 'paid') {
    return NextResponse.json({ ok: true, alreadyPaid: true })
  }

  // 2-b) 서버사이드 가격/포인트 재검증 (audit 1-1, 1-2)
  // 클라이언트가 CheckoutForm 에서 insert 한 total_amount/points_earned 를
  // 그대로 신뢰하지 않는다. order_items 의 unit_price 합 + 등급 적립률 +
  // 쿠폰 할인 + 사용 포인트 + 배송비로 다시 계산해 위변조를 차단.
  const { data: items } = await supabase
    .from('order_items')
    .select('unit_price, quantity, line_total')
    .eq('order_id', order.id)

  if (items && items.length > 0) {
    const recomputedSubtotal = items.reduce(
      (sum, it) => sum + (it.unit_price ?? 0) * (it.quantity ?? 0),
      0,
    )
    const storedSubtotal = order.subtotal ?? 0
    if (recomputedSubtotal !== storedSubtotal) {
      captureBusinessEvent('warning', 'order.payment.subtotal_mismatch', {
        orderId,
        storedSubtotal,
        recomputedSubtotal,
      })
      // R91-D #1: 상품 가격 위변조 — fatal fraud alert.
      alertFraud({
        orderId: order.id,
        reason: 'subtotal_mismatch',
      })
      return NextResponse.json(
        { code: 'PRICE_TAMPERED', message: '상품 금액이 일치하지 않아요. 주문을 새로 만들어 주세요.' },
        { status: 400 },
      )
    }

    // R82-G2: discount_amount + points_used 위변조 검증 강화.
    // 이전 코드 (R81 audit 발견) 는 클라이언트 값을 그대로 신뢰 → 사용자가
    // discount=50000 + total=3000 으로 주문 만들어 3000원 결제 가능.
    // 이제 coupon_code 가 있으면 실제 쿠폰 fetch + computeCouponDiscount 재계산,
    // points_used 는 현재 잔액 이하 검증.

    // 1) discount 위변조 검증
    const storedDiscount = order.discount_amount ?? 0
    if (storedDiscount > 0) {
      const couponCode = (order as { coupon_code?: string | null }).coupon_code
      if (!couponCode) {
        captureBusinessEvent('warning', 'order.payment.discount_no_coupon', {
          orderId,
          storedDiscount,
        })
        return NextResponse.json(
          { code: 'PRICE_TAMPERED', message: '할인 금액이 일치하지 않아요.' },
          { status: 400 },
        )
      }
      const { computeCouponDiscount } = await import('@/lib/coupons')
      const { data: coupon } = await supabase
        .from('coupons')
        .select(
          'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, is_active',
        )
        .eq('code', couponCode.toUpperCase())
        .maybeSingle()
      if (!coupon || !coupon.is_active) {
        captureBusinessEvent('warning', 'order.payment.discount_invalid_coupon', {
          orderId,
          couponCode,
        })
        return NextResponse.json(
          { code: 'PRICE_TAMPERED', message: '쿠폰이 유효하지 않아요.' },
          { status: 400 },
        )
      }
      const expectedDiscount = computeCouponDiscount(
        coupon as unknown as Parameters<typeof computeCouponDiscount>[0],
        recomputedSubtotal,
      )
      if (expectedDiscount !== storedDiscount) {
        captureBusinessEvent('warning', 'order.payment.discount_mismatch', {
          orderId,
          storedDiscount,
          expectedDiscount,
          couponCode,
        })
        return NextResponse.json(
          { code: 'PRICE_TAMPERED', message: '할인 금액 계산이 일치하지 않아요. 주문을 새로 만들어 주세요.' },
          { status: 400 },
        )
      }
    }

    // 2) points_used 위변조 검증 — checkout 흐름에서 ledger debit 가 실제로
    //    storedPoints 만큼 발생했는지 확인.
    //
    // 이전 가드 (R82-G2 이전): `storedPoints > currentBalance + storedPoints` =
    //    `0 > currentBalance` 인데 잔액은 음수가 될 수 없어 dead code. 무한 포인트
    //    위변조 (DevTools 로 points_used 부풀려 결제 금액 줄이기) 차단 불가.
    //
    // 새 가드: ledger 에 (user_id=user, reference_type='order', reference_id=orderId,
    //    delta<0) row 가 존재하고 |delta| === storedPoints 인지 검사. checkout
    //    이 debit 안 했거나 금액 다르면 위변조.
    const storedPoints = order.points_used ?? 0
    if (storedPoints > 0) {
      const { data: debitRow } = await supabase
        .from('point_ledger')
        .select('delta')
        .eq('user_id', user.id)
        .eq('reference_type', 'order')
        .eq('reference_id', orderId)
        .lt('delta', 0)
        .maybeSingle()
      const actualDebited = debitRow ? Math.abs(debitRow.delta) : 0
      if (!debitRow || actualDebited !== storedPoints) {
        captureBusinessEvent('warning', 'order.payment.points_debit_mismatch', {
          orderId,
          storedPoints,
          actualDebited,
        })
        return NextResponse.json(
          {
            code: 'PRICE_TAMPERED',
            message: '포인트 처리에 문제가 있어요. 주문을 새로 만들어 주세요.',
          },
          { status: 400 },
        )
      }
    }

    const recomputedTotal =
      recomputedSubtotal +
      (order.shipping_fee ?? 0) -
      storedDiscount -
      storedPoints

    if (recomputedTotal !== order.total_amount) {
      captureBusinessEvent('warning', 'order.payment.total_mismatch', {
        orderId,
        storedTotal: order.total_amount,
        recomputedTotal,
      })
      // R91-D #1: 최종 결제 금액 위변조 — fatal fraud alert.
      alertFraud({
        orderId: order.id,
        reason: 'total_mismatch',
      })
      return NextResponse.json(
        { code: 'PRICE_TAMPERED', message: '결제 금액이 일치하지 않아요. 주문을 새로 만들어 주세요.' },
        { status: 400 },
      )
    }

    // 포인트 적립 — 사용자 등급의 실제 earnRate 로 재계산.
    // 클라이언트가 적은 points_earned 가 등급 한도를 넘으면 거부 (저장 안 함).
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle()
    const tier = tierMeta(profile?.tier)
    const expectedPointsEarned = Math.floor(
      (Math.max(0, recomputedTotal) * tier.earnRate) / 100,
    )
    const storedPointsEarned = order.points_earned ?? 0
    if (storedPointsEarned > expectedPointsEarned) {
      captureBusinessEvent('warning', 'order.payment.points_inflated', {
        orderId,
        userId: user.id,
        storedPointsEarned,
        expectedPointsEarned,
        tier: tier.key,
      })
      // 즉시 거부하지 않고 안전한 값으로 보정 — 운영 차원에서 결제 자체는
      // 통과시키되 ledger 에 들어갈 금액만 등급 기준으로 강제.
      await supabase
        .from('orders')
        .update({ points_earned: expectedPointsEarned })
        .eq('id', order.id)
      order.points_earned = expectedPointsEarned
    }
  }

  // 3) 토스페이먼츠 승인 API 호출 — lib/payments/toss 가 Idempotency-Key 포함.
  // Sentry 트레이싱 wrap — 결제 confirm 실패율 + latency 추적.
  const result = await traceBusiness(
    'order.payment.confirm',
    {
      'order.id': orderId,
      'order.amount': amount,
    },
    () => confirmPayment({ paymentKey, orderId, amount }),
  )

  if (!result.ok) {
    const prevStatus = order.payment_status
    // 승인 실패 → 주문 상태 failed로
    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('id', order.id)

    // R60 결제 원장 — 사용자 체크아웃 단계 실패도 ledger 기록.
    // 환불/조정 시 추적 가능. amount=0 (실제 청구 안 됨).
    const { recordPaymentEvent } = await import('@/lib/payment-events')
    await recordPaymentEvent(supabase, {
      orderId: order.id,
      paymentKey,
      eventType: 'failed',
      amount: 0,
      prevStatus,
      newStatus: 'failed',
      source: 'user_checkout',
      metadata: {
        error_code: result.error.code ?? null,
        error_message: result.error.message ?? null,
      },
    })

    // 매출 영향 이벤트 — Sentry 운영 채널에 알림.
    captureBusinessEvent('warning', 'order.payment.confirm.failed', {
      orderId,
      amount,
      errorCode: result.error.code ?? null,
    })

    return NextResponse.json(
      { code: result.error.code, message: result.error.message },
      { status: 400 }
    )
  }

  const payment = result.data

  // 4) 주문 상태 업데이트 — 가상계좌는 아직 입금 전이라 'paid'로 넘기면 안 됨.
  //    WAITING_FOR_DEPOSIT 상태는 'pending'으로 유지하고, 실제 입금 시
  //    /api/payments/webhook이 'paid'로 승격시킴.
  const isActuallyPaid = payment.status === 'DONE'
  const isWaitingDeposit = payment.status === 'WAITING_FOR_DEPOSIT'

  // 가상계좌 발급 정보. 입금 전까지 사용자에게 계좌 안내를 할 수 있도록 저장.
  const va = payment.virtualAccount
  const vaFields = isWaitingDeposit && va
    ? {
        virtual_account_bank: va.bankCode ?? null,
        virtual_account_number: va.accountNumber ?? null,
        virtual_account_due_date: va.dueDate ?? null,
        virtual_account_holder: va.customerName ?? null,
      }
    : {}

  // R85-B1: payment_status='pending' 가드 추가. 이전엔 이 가드 없어서
  // 사용자가 Toss 결제창 30분+ 머무는 사이 order-expire cron 이 만료 처리해
  // (status='cancelled' + 재고 복원 + 쿠폰 revoke + 포인트 환급) → 그 후
  // confirm 이 도착해 'paid' 로 덮어씀 → 결제 + 환불 동시 상태 → 고객은 돈도
  // 내고 환불도 받음. .eq + .select() 로 0-row 감지 시 자동 환불.
  const { data: updateRows, error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: isActuallyPaid ? 'paid' : 'pending',
      payment_method: payment.method ?? null,
      payment_key: paymentKey,
      paid_at: isActuallyPaid
        ? (payment.approvedAt ?? new Date().toISOString())
        : null,
      order_status: isActuallyPaid ? 'preparing' : 'pending',
      receipt_url: payment.receipt?.url ?? null,
      ...vaFields,
    })
    .eq('id', order.id)
    .eq('payment_status', 'pending')
    .select('id')

  // 0-row update = 다른 흐름 (cron expire, webhook, admin cancel) 이 이미
  // payment_status 를 변경함. 결제는 성공했지만 우리가 paid 로 못 박았으므로
  // 즉시 Toss 환불 + payment_refund_queue 로 fallback.
  if (!updateError && isActuallyPaid && (!updateRows || updateRows.length === 0)) {
    captureBusinessEvent('error', 'order.payment.race_already_terminal', {
      orderId,
      paymentKey,
    })
    const cancelResult = await cancelPayment({
      paymentKey,
      cancelReason: '주문 상태 race — 결제 후 만료 감지',
    })
    if (!cancelResult.ok) {
      try {
        const admin = createAdminClient()
        await (admin as unknown as {
          from: (t: string) => {
            insert: (r: Record<string, unknown>) => Promise<unknown>
          }
        })
          .from('payment_refund_queue')
          .insert({
            order_id: order.id,
            payment_key: paymentKey,
            amount: payment.totalAmount,
            reason: 'race_already_terminal',
            last_error: cancelResult.error.message,
          })
      } catch {
        /* queue insert 도 실패 — Sentry 로 이미 잡힘 */
      }
    }
    return NextResponse.json(
      {
        code: 'ORDER_ALREADY_TERMINAL',
        message:
          '주문이 이미 다른 흐름으로 처리됐어요. 환불 처리 중이니 마이페이지에서 확인해 주세요.',
      },
      { status: 409 },
    )
  }

  if (updateError) {
    // audit 2-2: Toss 는 이미 승인했는데 DB 가 실패 → orphan payment 발생.
    // 즉시 cancelPayment 로 환불 시도. 실패 시 payment_refund_queue 에 기록해
    // 운영 cron 이 재시도.
    captureBusinessEvent('error', 'order.payment.db_update_failed', {
      orderId,
      paymentKey,
      dbError: updateError.message,
    })
    if (isActuallyPaid) {
      const cancelResult = await cancelPayment({
        paymentKey,
        cancelReason: 'DB 업데이트 실패에 의한 자동 환불',
      })
      if (!cancelResult.ok) {
        // service-role 로 queue 에 기록 — 다음 cron 사이클에서 재시도.
        try {
          const admin = createAdminClient()
          // payment_refund_queue 는 migration 20260516000003 에서 추가됨.
          // types.ts 재생성 전이라 cast — 다음 generate 후 cast 제거.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('payment_refund_queue' as any) as any).insert({
            order_id: order.id,
            payment_key: paymentKey,
            amount: amount,
            reason: 'confirm_db_update_failed',
            attempts: 1,
            last_error: cancelResult.error.message,
          })
        } catch {
          /* queue 도 실패하면 Sentry 만 — 운영자 수동 처리 */
        }
      }
    }
    return NextResponse.json(
      { code: 'DB_UPDATE_FAILED', message: updateError.message },
      { status: 500 }
    )
  }

  // R60 — 결제 원장에 event 한 줄 insert. update 성공 후 즉시 기록.
  // best-effort: 실패해도 결제 흐름 막지 X (Sentry 에 잡힘).
  {
    const { recordPaymentEvent } = await import('@/lib/payment-events')
    await recordPaymentEvent(supabase, {
      orderId: order.id,
      paymentKey,
      eventType: isActuallyPaid ? 'paid' : 'webhook_received',
      amount: isActuallyPaid ? amount : 0,
      prevStatus: order.payment_status,
      newStatus: isActuallyPaid ? 'paid' : 'pending',
      source: 'user_checkout',
      actorUserId: user.id,
      metadata: {
        method: payment.method ?? null,
        isWaitingDeposit,
      },
    })
  }

  // 5) 포인트 적립 — 실제 결제 완료(DONE)일 때만. 가상계좌는 입금 웹훅에서 처리.
  if (isActuallyPaid && order.points_earned && order.points_earned > 0) {
    await creditPoints(supabase, {
      userId: user.id,
      amount: order.points_earned,
      reason: '주문 결제 적립',
      referenceType: 'order',
      referenceId: order.id,
    })
  }

  // 6) 장바구니 비우기 (가상계좌 포함 — 입금 대기 중에도 재주문 방지)
  await supabase.from('cart_items').delete().eq('user_id', user.id)

  // Phase 1 (2026-05-20): outcome 자동 기록 — 첫 주문 baseline / 재주문 추적.
  // 사용자 부담 0, 시스템이 자동 누적. 첫 박스 7일 후 체크인 cron 의 candidate
  // 가 되며, 정기구독 전환·환불·이탈 시점 LTV 추적에 활용.
  if (isActuallyPaid) {
    try {
      const { isFirstBoxForDog, recordOutcome } = await import('@/lib/feeding-outcomes')
      // dogs 가 여러 마리일 수 있으므로 첫 dog 만 (단순화 — 1주문 = 1대표 견)
      const { data: dogRow } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (dogRow) {
        const isFirst = await isFirstBoxForDog(supabase, dogRow.id)
        await recordOutcome(supabase, {
          dog_id: dogRow.id,
          user_id: user.id,
          source: isFirst ? 'first_order' : 'reorder',
          order_id: order.id,
        })
      }
    } catch {
      // best-effort — outcome 기록 실패가 결제 응답을 막지 않도록.
    }
  }

  // 7) 웹푸시 알림 — 실제 결제가 끝난 경우에만 "완료" 메시지를 보냄.
  //    가상계좌는 입금 전이니 별도의 "입금 대기" 안내는 주문 상세에서 처리.
  if (isActuallyPaid) {
    pushToUser(
      user.id,
      {
        title: '결제가 완료됐어요 🐾',
        body: `${amount.toLocaleString()}원 결제가 끝났어요. 주문 상세를 확인해 주세요.`,
        url: `/mypage/orders/${order.id}`,
        tag: `order-${order.id}`,
      },
      { category: 'order' },
    ).catch(() => {
      /* 푸시는 베스트 에포트 */
    })
  }

  // 8) 이메일 알림 — DONE 이면 주문 접수 메일, WAITING_FOR_DEPOSIT 이면 입금 안내.
  //    fire-and-forget. 메일 실패가 주문 응답을 늦추지 않도록 await 하지 않음.
  if (isActuallyPaid) {
    notifyOrderPlaced(supabase, {
      orderId: order.id,
      userId: user.id,
      orderNumber: order.order_number,
      recipientName: order.recipient_name ?? null,
      totalAmount: order.total_amount,
      shippingFee: order.shipping_fee ?? 0,
      paymentMethod: payment.method ?? null,
    }).catch(() => {
      /* 메일은 베스트 에포트 */
    })
  } else if (isWaitingDeposit && va?.accountNumber) {
    notifyVirtualAccountWaiting(supabase, {
      orderId: order.id,
      userId: user.id,
      orderNumber: order.order_number,
      recipientName: order.recipient_name ?? null,
      totalAmount: order.total_amount,
      bankCode: va.bankCode ?? null,
      accountNumber: va.accountNumber,
      accountHolder: va.customerName ?? null,
      dueDate: va.dueDate ?? null,
    }).catch(() => {
      /* 메일은 베스트 에포트 */
    })
  }

  return NextResponse.json({
    ok: true,
    status: payment.status,
    waitingForDeposit: isWaitingDeposit,
  })
}
