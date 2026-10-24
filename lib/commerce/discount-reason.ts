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
  // 고객 노출 명칭은 '서포터즈'(사장님 2026-09-26) — '체험단'은 내부·어드민 용어.
  trial_cheap: '서포터즈 할인',
  trial_half: '서포터즈 반값 할인',
  // 지인·쓰레드 유입 첫 박스 지정 할인 (2026-09-27, docs/NEIGHBOR_DISCOUNT_2026_09.md)
  neighbor: '이웃 할인',
}

/** 모르는 값·none·null 은 그냥 '할인' — 내부 코드를 고객에게 보이지 않는다. */
export function discountReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '할인'
  return DISCOUNT_REASON_LABEL[reason] ?? '할인'
}

/**
 * 어드민이 읽는 할인 이름 (2026-10-24 어드민 금액 말 정리). 사장님은 할인 종류를 구분해야 해서 고객용보다 구체적이다 —
 * 행사 할인은 '이벤트 할인'(설정 화면 이름과 같게), 서포터즈는 단계(100원·반값)까지. 모르는 값·none·null 은 '할인'.
 */
const ADMIN_DISCOUNT_LABEL: Record<string, string> = {
  promotion: '이벤트 할인',
  trial_cheap: '서포터즈 100원',
  trial_half: '서포터즈 반값',
  neighbor: '이웃 할인',
  tier: '등급 할인',
}

export function adminDiscountLabel(reason: string | null | undefined): string {
  if (!reason) return '할인'
  return ADMIN_DISCOUNT_LABEL[reason] ?? '할인'
}
