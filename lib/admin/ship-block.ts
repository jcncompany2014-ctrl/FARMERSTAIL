/**
 * 발송 금지 판정 — **피킹 리스트의 단일 진실**.
 *
 * # 왜 함수로 뽑았나 (2026-08-12 반증감사 2·3라운드)
 * 같은 판정이 화면 배지 · 배송 라벨 · CSV · 조리 합계 **네 곳**에 흩어져 있었고,
 * 그래서 실제로 갈라졌다:
 *  · 화면은 "청구 불가 — 발송하지 마세요" 라고 하는데 **라벨은 그대로 인쇄**됐다.
 *  · 청구가 **실패**한 건은 어느 가지에도 안 걸려 "발송일 아침 청구 예정" 으로
 *    떨어져 조리·포장·발송까지 갔다(무료 박스).
 *  · 고객이 결제 **전에** 멈춘 구독을 "돈은 이미 받았다" 로 단언했다.
 * 판정이 한 곳이면 이런 어긋남이 구조적으로 불가능하다.
 *
 * # 원칙
 * **돈을 받았다는 증거가 없으면 보내지 않는다.** 증거는 '결제됨 + 발송대기
 * (preparing) 주문의 존재'다 — status 나 날짜는 증거가 아니다(둘 다 고객이
 * 바꿀 수 있거나, 실패해도 그대로 남는다).
 */

export type ShipBlockInput = {
  /** 청구 크론과 같은 조건 — 카드 없음 / 영구 거절. */
  cannotCharge: boolean
  /** 오늘(KST) 청구가 실패했다 — last_failed_charge_at 의 KST 날짜 = 오늘. */
  chargeFailedToday: boolean
  /** 청구 전에 고객이 스스로 멈췄다 — paused + 결제된 주문 없음. */
  pausedBeforeCharge: boolean
  /**
   * ★고객이 이번 배송을 '미루기(skip)'해 날짜가 +14 로 밀렸지만 결제된 주문이
   * 없는 활성 구독 (2026-08-20 6라운드 감사). skip 은 next_delivery_date 를
   * shipDate+14 로 미는데, 그 값이 **이번 아침 청구된 구독의 날짜(chargedBumpDate)
   * 와 완전히 같다** — 날짜로는 구분이 안 된다. 그래서 피킹 리스트가 skip 건을
   * '청구 완료'로 오인해 무료 박스를 발송했다. 결제 증거(결제됨+preparing 주문)가
   * 없으면 발송하지 않는다는 이 파일의 원칙이 charged 경로에서만 깨져 있었다.
   */
  skippedNotCharged: boolean
}

export type ShipBlockReason =
  | 'cannot_charge'
  | 'charge_failed_today'
  | 'paused_before_charge'
  | 'skipped_not_charged'
  | null

/**
 * 발송을 막아야 하는 사유. null 이면 발송 가능.
 * 우선순위 = 확실한 것부터(카드 자체가 못 쓰는 상태 → 오늘 실패 → 고객 정지 →
 * 고객 미룸). 어느 사유든 공통 = **돈 받은 증거가 없다**.
 */
export function shipBlockReason(input: ShipBlockInput): ShipBlockReason {
  if (input.cannotCharge) return 'cannot_charge'
  if (input.chargeFailedToday) return 'charge_failed_today'
  if (input.pausedBeforeCharge) return 'paused_before_charge'
  if (input.skippedNotCharged) return 'skipped_not_charged'
  return null
}

/** 라벨·조리 합계가 쓰는 한 줄 판정. */
export function isShippable(input: ShipBlockInput): boolean {
  return shipBlockReason(input) === null
}

/** CSV·화면이 쓰는 짧은 한국어 라벨. */
export const SHIP_BLOCK_LABEL: Record<
  Exclude<ShipBlockReason, null>,
  string
> = {
  cannot_charge: '청구불가(발송금지)',
  charge_failed_today: '청구실패(발송금지)',
  paused_before_charge: '미결제-고객정지(발송금지)',
  skipped_not_charged: '고객미룸-미청구(발송금지)',
}
