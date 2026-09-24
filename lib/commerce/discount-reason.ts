/**
 * orders.discount_reason → 고객이 읽는 할인 이름 (순수 — 테스트: discount-reason.test.ts).
 *
 * 주문 상세·영수증이 `할인 (tier)`·`할인 (trial_cheap)` 처럼 내부 코드를 그대로 찍고 있었다
 * (2026-09-24 점검). 값 목록의 정본은 lib/payments/auto-discount.ts 이고, DB CHECK
 * (orders_discount_reason_check)와 규칙96 이 셋을 맞물려 잠근다.
 */
export const DISCOUNT_REASON_LABEL: Record<string, string> = {
  tier: '등급 할인',
  promotion: '프로모션 할인',
  trial_cheap: '체험단 할인',
  trial_half: '체험단 반값 할인',
}

/** 모르는 값·none·null 은 그냥 '할인' — 내부 코드를 고객에게 보이지 않는다. */
export function discountReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '할인'
  return DISCOUNT_REASON_LABEL[reason] ?? '할인'
}
