/**
 * Farmer's Tail — 주문 상태 FSM (유한 상태 기계).
 *
 * 여태까지 `order_status === 'cancelled' && x !== 'cancelled'` 같은 전환 가드가
 * `/api/admin/orders/[id]/status/route.ts` 와 `/api/orders/[id]/cancel/route.ts`,
 * `OrderStatusControl.tsx` 에 분산돼 있었다. 전환 규칙이 하나의 진실이 되려면
 * 한 곳에 써 두고 모든 호출처가 같은 걸 본다.
 *
 * 상태 정의
 * --------
 * `payment_status`: Toss payment lifecycle
 *   - 'pending'    : 주문 생성 직후, 결제 시도 전/중
 *   - 'paid'       : webhook 또는 confirm API가 결제 성공 기록
 *   - 'failed'     : confirm 실패
 *   - 'cancelled'  : 환불 완료 (Toss cancel API 성공)
 *
 * `order_status`: 물류·배송 lifecycle
 *   - 'pending'    : 결제 대기 (payment_status=pending)
 *   - 'preparing'  : 결제 완료, 출고 준비
 *   - 'shipping'   : 택배사 집하 이후
 *   - 'delivered'  : 배송 완료
 *   - 'cancelled'  : 주문 취소 (결제 취소 동반)
 *
 * 전환 규칙
 * --------
 * order_status는 기본적으로 순방향 (pending → preparing → shipping → delivered)
 * 단, cancelled는 terminal이 아닌 어느 중간 상태에서든 진입 가능.
 * admin은 drive 방향을 한 단계 역행(shipping → preparing) 할 수 있지만
 * delivered/cancelled 에서의 역행은 금지(환불은 별도 액션으로).
 */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'
export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'

/** 사용자 노출용 한국어 라벨. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '결제 대기',
  preparing: '준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '주문 취소',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  cancelled: '환불 완료',
}

/** 모든 order_status 값 배열 (enum 검증용). */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'preparing',
  'shipping',
  'delivered',
  'cancelled',
]

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'cancelled',
]

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && ORDER_STATUSES.includes(v as OrderStatus)
}

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === 'string' && PAYMENT_STATUSES.includes(v as PaymentStatus)
}

// --- 전환 규칙 ------------------------------------------------------------

/** payment_status 조건에 따라 허용되는 order_status 다음 후보들. */
interface TransitionContext {
  payment_status: PaymentStatus
  /** 주체 — 'admin'이 할 수 있는 전환과 'customer'가 할 수 있는 전환이 다름. */
  actor: 'admin' | 'customer' | 'system'
}

/**
 * 전환 룰북. (from, to) 쌍이 허용되는지와 그 조건을 반환.
 *
 *   - 'system'은 webhook/confirm API 등 서버 자동 — 제약 최소.
 *   - 'customer'는 본인 주문의 self-cancel만 가능.
 *   - 'admin'은 대부분의 전환 가능. delivered/cancelled에서 빠져나가는 건 불가.
 */
export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
  ctx: TransitionContext,
): { ok: true } | { ok: false; reason: string } {
  // 같은 상태로의 전환은 no-op — 명시적으로 거부해 호출처가 조용히 처리하게.
  if (from === to) {
    return { ok: false, reason: '현재와 같은 상태예요' }
  }

  // Terminal 상태 — delivered/cancelled 에서의 변경은 관리자도 불가.
  if (from === 'delivered') {
    return {
      ok: false,
      reason: '배송 완료된 주문은 상태를 변경할 수 없어요',
    }
  }
  if (from === 'cancelled') {
    return {
      ok: false,
      reason: '취소된 주문은 상태를 되돌릴 수 없어요',
    }
  }

  // cancelled 로의 전환 — 어느 활성 상태에서든 가능하지만 주체별 제약.
  if (to === 'cancelled') {
    if (ctx.actor === 'customer') {
      // 고객 셀프 취소는 배송 시작 전까지만.
      if (from !== 'pending' && from !== 'preparing') {
        return {
          ok: false,
          reason: '배송이 시작된 주문은 고객이 취소할 수 없어요',
        }
      }
    }
    return { ok: true }
  }

  // 고객은 cancel 외에는 상태를 바꿀 수 없음.
  if (ctx.actor === 'customer') {
    return { ok: false, reason: '고객이 실행할 수 없는 전환이에요' }
  }

  // 결제 미완 주문을 배송/완료로 보내는 건 금지.
  if ((to === 'shipping' || to === 'delivered') && ctx.payment_status !== 'paid') {
    return {
      ok: false,
      reason: '결제 완료 전에는 발송/완료 처리할 수 없어요',
    }
  }

  // pending 은 webhook 이 payment_status='paid' 로 바꾸면서 동반 전환되는 게 원칙.
  // 관리자 수동 pending→preparing 은 허용 (수기 입금 확인 등 예외 플로우).
  if (from === 'pending' && to === 'preparing') return { ok: true }

  // preparing → shipping : 발송. 정방향.
  if (from === 'preparing' && to === 'shipping') return { ok: true }
  // preparing → delivered : 드물지만(바로 수령 등) 허용 — shipped_at snapshot은 호출처가.
  if (from === 'preparing' && to === 'delivered') return { ok: true }

  // shipping → delivered : 배송 완료.
  if (from === 'shipping' && to === 'delivered') return { ok: true }
  // shipping → preparing : 오발송 회수 등. admin만.
  if (from === 'shipping' && to === 'preparing' && ctx.actor === 'admin') {
    return { ok: true }
  }

  return {
    ok: false,
    reason: `허용되지 않은 전환이에요 (${from} → ${to})`,
  }
}

/**
 * 현재 상태에서 **허용되는** 다음 상태 목록. admin UI가 버튼 배열로 렌더할 때 사용.
 */
export function nextOrderStatuses(
  from: OrderStatus,
  ctx: TransitionContext,
): OrderStatus[] {
  return ORDER_STATUSES.filter(
    (s) => s !== from && canTransitionOrderStatus(from, s, ctx).ok,
  )
}

/**
 * Terminal 판정 — 더 이상 상태가 바뀌지 않는 주문인지.
 */
export function isTerminalOrderStatus(s: OrderStatus): boolean {
  return s === 'delivered' || s === 'cancelled'
}

/**
 * payment_status 전환 규칙. 대부분 system-driven (webhook/confirm API).
 * 관리자 수동 조작은 매우 드문 케이스라 여기서는 허용 조합만 명시.
 */
export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: '현재와 같은 결제 상태예요' }

  // pending → any (최초 결제 시도 결과 반영).
  if (from === 'pending') return { ok: true }

  // paid → cancelled : 환불. 정상 경로.
  if (from === 'paid' && to === 'cancelled') return { ok: true }

  // paid → failed : 의미 없음 — 이미 성공한 결제. 방어적으로 막음.
  // failed → pending : 재시도를 위해 pending 으로 되돌리는 건 별도 주문 생성 패턴이
  //   더 깔끔해서 여기서는 막음.
  // cancelled → any : terminal.

  return {
    ok: false,
    reason: `허용되지 않은 결제 상태 전환이에요 (${from} → ${to})`,
  }
}
