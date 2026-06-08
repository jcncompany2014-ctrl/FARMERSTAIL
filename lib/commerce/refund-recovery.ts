import type { SupabaseClient } from '@supabase/supabase-js'
import { appendLedger } from './points'
import { revokeCouponRedemption } from '@/lib/coupons'

/**
 * lib/commerce/refund-recovery
 *
 * 주문이 "전액 취소" 상태로 전이될 때 사용자가 쓴 포인트 환급 + 쿠폰 회수를
 * 멱등하게 보장한다.
 *
 * 왜 필요: 취소가 cancel/cancel-items 라우트 밖에서 일어나는 경로가 있다 —
 *  - Toss 웹훅 CANCELED (토스 대시보드/토스측 취소)
 *  - confirm 의 race_already_terminal (다른 흐름이 먼저 terminal 로 만든 경우)
 * 이 경로들은 Toss 환불만 하고 포인트/쿠폰 복구를 빠뜨려, 고객이 결제 시 쓴
 * 포인트·1회용 쿠폰이 묶인 채 남는다(점검 medium).
 *
 * 멱등성:
 *  - 포인트: orders.points_refunded 누적을 상한으로 (points_used - points_refunded)
 *    만큼만, reference_id=order.id 로 환급. 이미 cancel 라우트가 환급했으면
 *    refundable=0 또는 unique 충돌로 no-op.
 *  - 쿠폰: 호출처(webhook)는 payment_status='cancelled' 가드로 재진입을 막으므로
 *    전이당 1회만 실행된다.
 *
 * admin(service_role) 클라이언트로 호출 — RLS 우회 필요(원장/쿠폰).
 */
export async function recoverOrderPointsAndCoupon(
  admin: SupabaseClient,
  orderId: string,
): Promise<void> {
  // 환급 관련 필드를 직접 읽어 호출처 select 의존을 없앤다. points_refunded 는
  // 신규 컬럼이라 typegen 미반영 → cast.
  const { data } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              user_id: string
              points_used: number | null
              points_refunded: number | null
              coupon_code: string | null
            } | null
          }>
        }
      }
    }
  })
    .from('orders')
    .select('user_id, points_used, points_refunded, coupon_code')
    .eq('id', orderId)
    .maybeSingle()

  if (!data) return

  const pointsUsed = data.points_used ?? 0
  const alreadyRefunded = data.points_refunded ?? 0
  const refundable = Math.max(0, pointsUsed - alreadyRefunded)
  if (refundable > 0) {
    const r = await appendLedger(admin, {
      userId: data.user_id,
      delta: refundable,
      reason: '주문 취소 포인트 환급',
      referenceType: 'order_refund_credit',
      referenceId: orderId,
    })
    if (r.ok) {
      await (admin as unknown as {
        from: (t: string) => {
          update: (x: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      })
        .from('orders')
        .update({ points_refunded: alreadyRefunded + refundable })
        .eq('id', orderId)
    }
  }

  if (data.coupon_code) {
    await revokeCouponRedemption(admin, { couponCode: data.coupon_code })
  }
}
