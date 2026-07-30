/**
 * 청구액 대조 — 저장 금액과 서버 재계산이 어긋나는지 **알린다**.
 *
 * # 이 파일은 2026-07-30 에 역할이 바뀌었다 (자동 차단 → 알림)
 *
 * ## 처음 만든 목적 (2026-07-29)
 * `subscriptions.total_amount` 를 고객이 REST 로 100원으로 바꿔놓고 정상 박스를
 * 받을 수 있었다. 그래서 청구 직전에 서버가 금액을 다시 계산해 대조하고,
 * 낮으면 청구를 **거부**하게 만들었다.
 *
 * ## 왜 바꿨나 — 두 가지가 드러났다 (최종감사)
 *
 * **① 그 방어는 우회됐다.** 재계산에는 강아지·화식비율·처방이 필요하고 없으면
 * 검사를 건너뛰었는데(`skip-check`), `fresh_ratio` 도 고객이 쓸 수 있는 칸이었다.
 * 조작 요청에 `"fresh_ratio": 0` 한 줄을 더하면 검문소가 그대로 비켜섰다.
 * → **올바른 층위는 여기가 아니었다.** 마이그레이션
 * `20260730000000_subscriptions_lock_money_columns.sql` 로 금액·화식비율·
 * 빌링키 등의 UPDATE 권한을 **아예 회수**했다. 값을 검사하는 대신 쓸 수 없게 만든다.
 *
 * **② 자동 차단이 정상 고객을 막고, 자동 하향이 돈을 깎았다.**
 * 재계산이 저장값과 **정당하게** 다를 수 있는 경우가 여럿이다:
 *   · 재고 변동 — 품절 중 주문(낮은 금액 저장) 후 재입고 → 재계산이 커짐
 *   · 플랜 화면에서 고객이 고른 레시피(`?recipes=`)가 DB 에 저장되지 않음
 *   · 처방 회차 기준 차이 (아래 recomputeChargeBase 주석 참조)
 * 이 노이즈는 **조작과 크기가 구분되지 않는다**(실측 40% 차이). 그래서
 *   · `stored < recomputed` 면 거부 → 정상 고객의 박스가 영구히 멈췄다
 *   · `stored > recomputed` 면 `min()` 으로 낮춰 청구 → **조용히 저청구**
 *     (실측: 8/4 청구 예정 건이 153,100원 → 90,900원, −40.6%)
 *
 * ## 지금 규칙
 * **항상 저장된 금액으로 청구한다.** 재계산은 대조·알림에만 쓴다.
 *  · 저장 금액 = 고객이 동의한 금액이고 **모든 화면이 보여주는 금액**이다.
 *    그보다 적게 긁는 것도, 많이 긁는 것도, 아예 안 긁는 것도 전부 배신이다.
 *  · 어긋나면 사장님에게 알린다 — 사람이 판단할 일이다.
 *
 * 자동 차단을 뺀 근거: UPDATE 권한이 닫힌 뒤 남은 조작 경로는 **구독을 만드는
 * 순간**뿐인데(브라우저가 total_amount 를 넣는다), 그건 앱을 우회해 요청을
 * 조립해야 하는 의도적 공격이다. 반면 위 노이즈는 **정상 운영에서 자연히**
 * 생긴다. 드문 공격을 자동으로 막으려고 흔한 정상을 막으면 손해가 크다.
 * 생성 시점 조작의 근본 해결은 구독 생성을 서버 라우트로 옮기는 것 — 후속 작업.
 */

/** 이 차이 이내는 반올림 오차로 본다(재계산은 kcal·처방 기반이라 10원 단위 차가 난다). */
export const CHARGE_AMOUNT_TOLERANCE = 100

export type ChargeAmountCheck = {
  /** 실제로 카드를 긁을 금액. **항상 저장된 금액이다.** */
  chargeBase: number
  /**
   * 사장님에게 알려야 하는가. 재계산이 허용 오차를 넘게 어긋났을 때.
   * 청구를 막지는 않는다 — 알리고 진행한다.
   */
  mismatch: boolean
  /** 재계산 결과. null = 근거 부족으로 대조 못 함(알림 대상 아님). */
  recomputed: number | null
  /** 어긋난 방향 — 알림 문구·판단에 쓴다. */
  direction: 'stored-lower' | 'stored-higher' | null
}

/**
 * @param stored subscriptions.total_amount — 고객이 동의하고 화면에 뜨는 금액
 * @param recomputed products 기준 서버 재계산. null = 계산 근거 없음
 */
export function checkChargeAmount(
  stored: number,
  recomputed: number | null,
): ChargeAmountCheck {
  // 재계산 불가 → 대조할 게 없다. 저장 금액으로 청구하고 조용히 넘어간다.
  // (예전엔 이 경로가 우회구멍이었지만, 이제 total_amount 자체를 못 고친다.)
  if (recomputed === null || !(recomputed > 0)) {
    return { chargeBase: stored, mismatch: false, recomputed: null, direction: null }
  }
  const diff = stored - recomputed
  if (Math.abs(diff) <= CHARGE_AMOUNT_TOLERANCE) {
    return { chargeBase: stored, mismatch: false, recomputed, direction: null }
  }
  return {
    chargeBase: stored,
    mismatch: true,
    recomputed,
    direction: diff < 0 ? 'stored-lower' : 'stored-higher',
  }
}
