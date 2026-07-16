/**
 * Farmer's Tail — 자동 할인 정책.
 *
 * 할인 = **주문 시점 자동 계산**. 코드·발급·보유·만료가 없다(쿠폰 폐기 2026-06-30).
 * 이 파일은 **순수 정책 함수** — DB/결제 무관.
 *
 * # 정책 (사장님 확정 2026-07-16) — 할인은 **하나뿐**
 *   나무 등급(스탬프 50개) · **매 주문 10%**
 *
 * 그게 전부다. 예전엔 첫주문 50% · 꽃 반기 25% · 열매 분기 20% · 생일 20% 가 있었고
 * "스택 금지·최댓값 1개·슬롯 한도" 규칙이 딸려 있었다(tierSlotRange 로 분기/반기
 * 경계를 구해 주문 이력을 세는 것까지). 전부 걷어냈다.
 *
 * # 왜 하나만 남기나
 * 로열티 서사를 **스탬프 하나**로 통일했기 때문이다. 할인이 다섯 갈래로 흩어져 있으면
 * 고객은 "내가 지금 왜 이 값을 내는지" 를 모르고, 우리는 마진을 못 읽는다.
 * 스탬프 50개(약 2년) = 매 주문 10% — **오래 함께한 사람에게만, 대신 계속.**
 * 이 한 줄로 설명이 끝난다.
 *
 * # 이벤트 할인은 여기 없다
 * 오프라인·인스타 이벤트용 50% 같은 건 **등급과 무관한 별도 프로모션**이라 이 파일에
 * 섞지 않는다(섞으면 또 "스택 금지·우선순위" 규칙이 자란다). 프로모션 링크 시스템이
 * 붙으면 그쪽에서 계산해 이 결과와 **더 큰 쪽 하나**만 고른다.
 */
import type { TierKey } from './tiers.ts'

export type DiscountReason = 'tier' | 'none'

export type AutoDiscount = {
  /** 할인율 (0~1). 0 이면 할인 없음. */
  rate: number
  reason: DiscountReason
  /** 사람이 읽는 라벨 (UI/주문 기록). 할인 없으면 ''. */
  label: string
}

/** 나무 등급 할인율 — 매 주문. */
export const MATE_RATE = 0.1

/**
 * 등급별 자동 할인율. null = 할인 없음.
 * **나무만 할인이 있다.** 등급이 없는 사람(스탬프 10개 미만)도 당연히 없다.
 */
export const TIER_DISCOUNT: Record<TierKey, number | null> = {
  seed: null,
  sprout: null,
  bloom: null,
  fruit: null,
  mate: MATE_RATE, // 매 주문 10%
}

const NONE: AutoDiscount = { rate: 0, reason: 'none', label: '' }

export type AutoDiscountInput = {
  /** 회원 등급. 등급이 없으면(스탬프 10개 미만) null. */
  tier: TierKey | null
}

/**
 * 주문 1건의 자동 할인 결정.
 *
 * 규칙이 하나뿐이라 분기도 하나다 — 나무면 10%, 아니면 없음.
 */
export function computeAutoDiscount(input: AutoDiscountInput): AutoDiscount {
  if (input.tier == null) return NONE
  const rate = TIER_DISCOUNT[input.tier]
  if (rate == null) return NONE
  return { rate, reason: 'tier', label: '나무 등급 할인' }
}

/**
 * 할인율 → 할인 **금액**(원). 원 단위 내림(소비자 유리), subtotal 초과 방지.
 * 호출측: total = subtotal - applyDiscount(subtotal, rate).
 */
export function applyDiscount(subtotal: number, rate: number): number {
  if (rate <= 0 || subtotal <= 0) return 0
  const capped = Math.min(rate, 1)
  return Math.min(Math.floor(subtotal * capped), subtotal)
}
