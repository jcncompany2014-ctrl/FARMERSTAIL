import type { SupabaseClient } from '@supabase/supabase-js'
import { appendLedger, getCurrentBalance } from './points'
import { revokeCouponRedemption } from '@/lib/coupons'

/**
 * lib/commerce/refund-recovery
 *
 * 주문이 "전액 취소" 상태로 전이될 때 사용자 자산(사용 포인트 환급 + 적립 포인트
 * 회수 + 쿠폰 회수)을 멱등하게 복구한다.
 *
 * 왜: 취소가 cancel/cancel-items 라우트 밖(웹훅 CANCELED, confirm race)에서
 * 일어나면 이 복구가 누락돼 고객 포인트·쿠폰이 묶이거나(사용 포인트) 적립이 남는다.
 *
 * 멱등:
 *  - 사용 포인트: refund_order_points RPC 가 orders 행 잠금 + points_refunded 상한
 *    으로 잔여분만 환급(reference=order.id, 전액취소는 주문당 1회). 이미 환급됐으면 0.
 *  - 적립 포인트: order_refund_revoke + reference=order.id → unique index 멱등.
 *  - 쿠폰: 호출처(webhook)의 payment_status 가드로 전이당 1회만 실행.
 */

/** 적립 포인트(points_earned) 회수 — 잔액 부족 시 한도 내 부분 회수 + shortfall 로깅. */
export async function clawbackEarnedPoints(
  admin: SupabaseClient,
  args: {
    orderId: string
    userId: string
    pointsEarned: number
    paymentStatus: string | null
  },
): Promise<void> {
  const { orderId, userId, pointsEarned, paymentStatus } = args
  // pending(미결제) 주문은 적립이 안 됐으므로 회수 불필요.
  if (!pointsEarned || pointsEarned <= 0 || paymentStatus === 'pending') return

  const revoke = await appendLedger(admin, {
    userId,
    delta: -pointsEarned,
    reason: '주문 취소 적립 회수',
    referenceType: 'order_refund_revoke',
    referenceId: orderId,
  })
  if (!revoke.ok) {
    // 적립금을 이미 다른 데 써서 잔액 < earned 면 RPC 가 v_next<0 으로 거부.
    // 현재 잔액 한도로 부분 회수하고 부족분은 운영자 인지용 로그.
    const balance = await getCurrentBalance(admin, userId)
    const partial = Math.min(pointsEarned, Math.max(0, balance))
    if (partial > 0) {
      await appendLedger(admin, {
        userId,
        delta: -partial,
        reason: '주문 취소 적립 부분 회수(잔액 한도)',
        referenceType: 'order_refund_revoke',
        referenceId: orderId,
      })
    }
    const shortfall = pointsEarned - partial
    if (shortfall > 0) {
      console.error(
        `[refund-recovery] earned clawback shortfall: order=${orderId} user=${userId} earned=${pointsEarned} revoked=${partial} shortfall=${shortfall}`,
      )
    }
  }
}

export async function recoverOrderPointsAndCoupon(
  admin: SupabaseClient,
  orderId: string,
): Promise<void> {
  // 복구에 필요한 필드 직접 read(호출처 select 의존 제거). points_refunded 는
  // 신규 컬럼이라 typegen 미반영 → cast.
  const { data } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              user_id: string
              points_used: number | null
              points_earned: number | null
              payment_status: string | null
              coupon_code: string | null
            } | null
          }>
        }
      }
    }
  })
    .from('orders')
    .select('user_id, points_used, points_earned, payment_status, coupon_code')
    .eq('id', orderId)
    .maybeSingle()

  if (!data) return

  // 사용 포인트 환급 — 원자 RPC(잔여분만, 이미 환급됐으면 0). reference=order.id.
  if ((data.points_used ?? 0) > 0) {
    await admin.rpc('refund_order_points', {
      p_order_id: orderId,
      p_user_id: data.user_id,
      p_request: data.points_used ?? 0,
      p_reason: '주문 취소 포인트 환급',
      p_reference_id: orderId,
    })
  }

  // 적립 포인트 회수(멱등).
  await clawbackEarnedPoints(admin, {
    orderId,
    userId: data.user_id,
    pointsEarned: data.points_earned ?? 0,
    paymentStatus: data.payment_status,
  })

  // 쿠폰 회수.
  if (data.coupon_code) {
    await revokeCouponRedemption(admin, { couponCode: data.coupon_code })
  }
}
