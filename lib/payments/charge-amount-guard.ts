/**
 * 청구액 검문소 — "고객이 바꿔놓은 금액"으로 카드를 긁지 않게 (2026-07-29).
 *
 * # 무슨 취약점이었나 (결제 감사 critical)
 * `subscriptions.total_amount` 는 **로그인한 고객이 직접 쓸 수 있다**:
 *   · RLS 정책 `subs_update_own_or_admin` = 소유자면 UPDATE 허용(컬럼 제한 없음)
 *   · `authenticated` 에게 total_amount·subtotal UPDATE 권한 존재(실측)
 *   · anon key 는 공개값이라 앱을 거치지 않고 REST 로 바로 PATCH 가능
 * 그런데 청구 크론은 `const subtotal = sub.total_amount` 로 **그 값을 그대로**
 * 카드에 긁었다. 즉 고객이 자기 구독 금액을 100원으로 바꾸면 100원만 내고
 * 정상 박스를 받는다(피킹 리스트는 금액을 안 본다). 주문 경로는 order_items
 * 합으로 재계산해 막고 있었는데, **실제 유일한 결제 경로인 구독 청구엔 그
 * 방어가 없었다.**
 *
 * # 왜 여기서 막나
 * `subscription_items.unit_price` 도 고객이 쓸 수 있으므로 "items 합과 대조"는
 * 방어가 안 된다. 신뢰할 수 있는 가격 원천은 **`products` 테이블 하나뿐**이다
 * (RLS: 관리자만 쓰기 — 실측). 그래서 승인 라우트가 쓰는 것과 같은 경로
 * (`priceForFormula` = 처방 + products)로 **서버가 다시 계산**해 대조한다.
 *
 * # 판정
 *  · 재계산 불가(처방·화식비율·제품 없음) → `verdict: 'skip-check'`.
 *    돈을 추측하지 않는다 — 계산 근거가 없으면 기존 금액으로 진행한다.
 *  · 저장 금액이 재계산보다 **낮으면**(허용 오차 초과) → `verdict: 'refuse'`.
 *    조작 가능성이므로 청구하지 않고 알린다.
 *  · 높으면 → `verdict: 'ok'` 이지만 재계산값으로 **내려서** 청구한다.
 *    고객에게 유리한 방향의 불일치는 막지 않되 과청구는 하지 않는다.
 *
 * 허용 오차: 재계산은 처방·kcal 기반이라 저장 시점과 10원 단위 반올림 차가
 * 날 수 있다. 100원까지는 정상 오차로 본다(조작은 보통 수천~수만원 단위).
 */

export const CHARGE_AMOUNT_TOLERANCE = 100

export type ChargeGuardVerdict =
  | { verdict: 'skip-check'; reason: string }
  | { verdict: 'ok'; chargeBase: number; recomputed: number }
  | { verdict: 'refuse'; stored: number; recomputed: number }

/**
 * @param stored  subscriptions.total_amount (고객이 쓸 수 있는 값)
 * @param recomputed products 기준 서버 재계산 총액. null = 계산 불가
 */
export function checkChargeAmount(
  stored: number,
  recomputed: number | null,
): ChargeGuardVerdict {
  if (recomputed === null || !(recomputed > 0)) {
    return { verdict: 'skip-check', reason: 'RECOMPUTE_UNAVAILABLE' }
  }
  if (!(stored > 0)) {
    // 0원·음수 저장 금액은 그 자체로 비정상 — 청구 시도 자체가 실패한다.
    return { verdict: 'refuse', stored, recomputed }
  }
  if (stored < recomputed - CHARGE_AMOUNT_TOLERANCE) {
    return { verdict: 'refuse', stored, recomputed }
  }
  // 저장값이 재계산보다 크면 재계산값으로 낮춰 청구(과청구 방지).
  const chargeBase = Math.min(stored, recomputed)
  return { verdict: 'ok', chargeBase, recomputed }
}
