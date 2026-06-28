/**
 * Farmer's Tail — 자동 할인 정책 (쿠폰 대체).
 *
 * 쿠폰(발급/보유/사용/만료/코드)을 폐기하고, 할인 = **주문 시점 자동 계산**으로
 * 통일. 이 파일은 **순수 정책 함수** — DB/결제 무관. 결제 흐름이 입력값(첫주문
 * 여부·등급·이번 슬롯 등급할인 사용 여부·강아지 생일月 여부)을 모아 호출한다.
 *
 * 정책(사장님 확정 2026-06-27 · 분기/반기 spread 2026-06-27):
 *  - 첫 주문(결제 0건): 50% · 계정당 1회 · 최우선
 *  - 등급별 자동 할인 — 연 횟수를 "슬롯"으로 **퍼뜨려** 한 슬롯에 1회씩(몰림 방지):
 *      꽃   반기 1회(연 2슬롯) · 25%
 *      열매 분기 1회(연 4슬롯) · 20%
 *      나무 매 청구 · 10%
 *  - 생일 할인: 강아지 생일 月 · 20% · 연 1회
 *  - 스택 금지: 한 주문엔 **가장 큰 할인 1개**만(마진 안전).
 *
 * 슬롯 한도도 쿠폰 없이 자동 — 호출측이 `tierSlotRange()` 로 이번 슬롯 경계를
 * 구하고, 그 기간 주문 이력에서 "이미 등급 할인 받았는지"(boolean)를 세서 입력으로
 * 넘기면, 이 함수가 적용 여부만 결정한다(코드/발급/만료 0).
 */
import type { TierKey } from './tiers.ts'

export type DiscountReason = 'first_order' | 'tier' | 'birthday' | 'none'

export type AutoDiscount = {
  /** 할인율 (0~1). 0 이면 할인 없음. */
  rate: number
  reason: DiscountReason
  /** 사람이 읽는 라벨 (UI/주문 기록). 할인 없으면 ''. */
  label: string
}

/** 첫 주문 할인율. */
export const FIRST_ORDER_RATE = 0.5
/** 생일(강아지 생일 月) 할인율 — 연 1회. */
export const BIRTHDAY_RATE = 0.2

/**
 * 등급별 자동 할인 정책. null = 할인 없음.
 *  - cadence 'every'   : 매 청구마다 적용 (나무).
 *  - cadence 'slotted' : 1년을 slotsPerYear 슬롯으로 나눠 슬롯당 1회 (꽃·열매).
 */
export type TierDiscountPolicy =
  | { rate: number; cadence: 'every' }
  | { rate: number; cadence: 'slotted'; slotsPerYear: number }

export const TIER_DISCOUNT: Record<TierKey, TierDiscountPolicy | null> = {
  seed: null,
  sprout: null,
  bloom: { rate: 0.25, cadence: 'slotted', slotsPerYear: 2 }, // 반기 1회
  fruit: { rate: 0.2, cadence: 'slotted', slotsPerYear: 4 }, // 분기 1회
  mate: { rate: 0.1, cadence: 'every' }, // 매 청구
}

const TIER_LABEL: Record<TierKey, string> = {
  seed: '씨앗',
  sprout: '새싹',
  bloom: '꽃',
  fruit: '열매',
  mate: '나무',
}

const NONE: AutoDiscount = { rate: 0, reason: 'none', label: '' }

export type AutoDiscountInput = {
  /** 이 계정의 첫 결제(paid 0건)인가. */
  isFirstPaidOrder: boolean
  /** 회원 등급. */
  tier: TierKey
  /**
   * slotted 등급: 이번 청구가 속한 슬롯에서 **이미 등급 할인을 받았는가**.
   * cadence='every'(나무)·null(씨앗·새싹) 등급에선 무시된다.
   */
  tierDiscountUsedThisSlot: boolean
  /** 이번 주문이 강아지 생일 月인가. */
  isDogBirthdayMonth: boolean
  /** 올해 이미 생일 할인을 받았는가. */
  birthdayDiscountUsedThisYear: boolean
}

/**
 * 주문 1건의 자동 할인 결정. 쿠폰 없음 — 입력값만으로 순수 계산.
 * 스택 금지: 적용 가능한 할인 중 **가장 큰 1개**만 반환.
 */
export function computeAutoDiscount(input: AutoDiscountInput): AutoDiscount {
  // 1) 첫 주문 50% — 최우선·계정당 1회. 등급·생일보다 앞선다.
  if (input.isFirstPaidOrder) {
    return { rate: FIRST_ORDER_RATE, reason: 'first_order', label: '첫 주문 50% 할인' }
  }

  // 2) 후보 모으기 — 스택 금지라 최댓값 1개만 고른다.
  const candidates: AutoDiscount[] = []

  const tierPolicy = TIER_DISCOUNT[input.tier]
  if (tierPolicy) {
    // 'every'(나무)는 매번, 'slotted'(꽃·열매)는 이번 슬롯 미사용일 때만.
    const eligible =
      tierPolicy.cadence === 'every' || !input.tierDiscountUsedThisSlot
    if (eligible) {
      candidates.push({
        rate: tierPolicy.rate,
        reason: 'tier',
        label: `${TIER_LABEL[input.tier]} 등급 할인`,
      })
    }
  }

  if (input.isDogBirthdayMonth && !input.birthdayDiscountUsedThisYear) {
    candidates.push({ rate: BIRTHDAY_RATE, reason: 'birthday', label: '생일 축하 할인' })
  }

  if (candidates.length === 0) return NONE

  return candidates.reduce((best, c) => (c.rate > best.rate ? c : best))
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

/**
 * slotted 등급의 "현재 슬롯" 경계 [start, end) 를 YYYY-MM-DD 로 반환 (UTC 계산).
 * 1년을 slotsPerYear 등분 — 4=분기(3개월), 2=반기(6개월). 호출측이 이 범위로
 * 주문 이력을 조회해 "이 슬롯에 이미 등급 할인 썼는지"를 판정한다.
 *
 * 예) slotsPerYear=4, todayIso='2026-05-10' → { start:'2026-04-01', end:'2026-07-01' } (Q2)
 *     slotsPerYear=2, todayIso='2026-05-10' → { start:'2026-01-01', end:'2026-07-01' } (H1)
 */
export function tierSlotRange(
  slotsPerYear: number,
  todayIso: string,
): { start: string; end: string } {
  const d = new Date(todayIso + 'T00:00:00Z')
  const year = d.getUTCFullYear()
  const monthsPerSlot = Math.round(12 / slotsPerYear)
  const slotIdx = Math.floor(d.getUTCMonth() / monthsPerSlot)
  const startMonth = slotIdx * monthsPerSlot
  const start = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(year, startMonth + monthsPerSlot, 1))
    .toISOString()
    .slice(0, 10)
  return { start, end }
}
