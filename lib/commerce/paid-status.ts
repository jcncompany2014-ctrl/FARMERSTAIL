/**
 * "돈을 받은 주문"의 정의 — 정본 한 곳.
 * (2026-08-07 어드민 감사)
 *
 * # 왜 필요한가
 * 발송 큐 세 곳이 전부 `payment_status = 'paid'` 만 셌다:
 *   · 대시보드 "발송할 주문" 카드
 *   · 처리 대기 "미발송(24시간+)"
 *   · /admin/orders?status=preparing (위 카드가 링크하는 바로 그 화면)
 *
 * 그런데 품절 1종을 부분 환불하면 `payment_status` 가 **'partially_refunded'**
 * 가 된다. 즉 **돈은 일부만 돌려주고 박스는 여전히 보내야 하는 주문이 오늘
 * 보낼 목록 세 군데에서 동시에 사라진다.** 전체 목록에서도 회색 '부분 환불'
 * 배지라 처리할 일로 안 보인다.
 *
 * 매출 집계도 같은 이유로 어긋났다 — 1,000원만 부분 환불해도 그 주문 10만원
 * **전체가 매출에서 증발**한다.
 *
 * 같은 규칙이 여러 곳에 흩어지면 갈라진다(이 저장소에서 여러 번 확인했다).
 * 그래서 "받은 돈이 남아 있는 상태"를 여기 한 곳에 둔다.
 */

/**
 * 돈을 받았고 아직 전액 환불되지 않은 주문 상태.
 *
 * 발송 대상 판정·매출 집계는 이 목록을 쓴다. `refunded`·`cancelled` 는
 * 제외 — 그건 돈이 돌아간 것이다.
 */
export const PAID_STATUSES = ['paid', 'partially_refunded'] as const

export type PaidStatus = (typeof PAID_STATUSES)[number]

/** 이 주문이 "돈을 받은 것"인가. */
export function isPaidStatus(s: string | null | undefined): boolean {
  return s === 'paid' || s === 'partially_refunded'
}

/**
 * 매출로 잡을 실수령액.
 *
 * 부분 환불은 total_amount 는 그대로 두고 refunded_amount 만 올린다.
 * 그래서 `total - refunded` 가 실제로 남은 돈이다. 음수는 만들지 않는다.
 */
export function netPaidAmount(o: {
  total_amount: number | null
  refunded_amount?: number | null
}): number {
  const total = o.total_amount ?? 0
  const refunded = o.refunded_amount ?? 0
  return Math.max(0, total - refunded)
}
