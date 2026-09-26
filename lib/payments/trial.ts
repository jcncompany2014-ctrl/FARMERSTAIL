/**
 * 체험단 3단 가격 — docs/TRIAL_PROGRAM_2026_10.md v2 (2026-09-24 사장님 승인).
 *
 *   ① cheap_remaining 회차: 박스당 cheap_price 원 고정 (기본 100원)
 *   ② half_remaining 회차: 자기 산출 구독가(subtotal)의 half_rate (기본 50%)
 *   ③ 소진: null → 등급·프로모션 등 평소 규칙으로
 *
 * # 왜 등급·프로모션과 절대 겹치지 않나
 * 체험 가격이 있으면 그것만 쓴다(등급 10%·이벤트 할인보다 항상 크다). 프로모션
 * claim 은 건드리지 않고 남겨 둔다 — 체험이 끝난 뒤 첫 정상 결제에 쓸 수 있다.
 *
 * # 숫자는 규칙으로 (lib/promotions.ts 와 같은 원칙)
 * 판정은 전부 순수 함수 — DB·시간 없이 재현·테스트 가능해야 돈 판단을 믿을 수 있다.
 */
/** DB `subscription_trials` 행의 판정용 부분집합. */
export type TrialState = {
  cheap_remaining: number
  half_remaining: number
  cheap_price: number
  half_rate: number
}

export type TrialPhase = 'cheap' | 'half'

export type TrialPricing = {
  phase: TrialPhase
  chargeAmount: number
  discountAmount: number
  /** 화면 라벨 — 청구·미리보기 공용. */
  label: string
  /** 이 구간의 남은 회차(이번 결제 포함). 화면 "N번째 박스" 표기용. */
  remaining: number
}

/**
 * 이번 청구에 적용할 체험 가격. 체험이 아니거나 소진됐으면 null.
 *
 * cheap 가격이 subtotal 보다 크면(초소형견 극단 케이스) subtotal 을 그대로 —
 * 체험가가 "할인"인데 더 비싸지는 역전은 만들지 않는다.
 */
export function trialPricing(state: TrialState | null, subtotal: number): TrialPricing | null {
  if (!state) return null
  if (state.cheap_remaining > 0) {
    const chargeAmount = Math.min(Math.max(100, Math.trunc(state.cheap_price)), subtotal)
    return {
      phase: 'cheap',
      chargeAmount,
      discountAmount: subtotal - chargeAmount,
      // 고객 노출 명칭은 '서포터즈' (사장님 2026-09-26 — "체험단"은 내부 용어).
      label: `서포터즈 ${chargeAmount.toLocaleString()}원`,
      remaining: state.cheap_remaining,
    }
  }
  if (state.half_remaining > 0) {
    // 반값도 최소 100원 아래로는 안 내려간다 (카드 최소금액 — 결제감사 #7 계열).
    const rate = Math.min(0.99, Math.max(0.01, state.half_rate))
    const chargeAmount = Math.max(100, subtotal - Math.round(subtotal * rate))
    return {
      phase: 'half',
      chargeAmount,
      discountAmount: subtotal - chargeAmount,
      label: `서포터즈 반값`,
      remaining: state.half_remaining,
    }
  }
  return null
}

