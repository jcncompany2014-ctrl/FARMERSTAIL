/**
 * Farmer's Tail — Mix feeding 비율 + 예산 default 시나리오 (Tier S F3-2/F3-3)
 *
 * 화식·건사료 비율 자동 계산 + 예산 응답 기반 default 시나리오 매핑.
 *
 * # 시장 현실 (KB 펫보고서 2024)
 * - 건사료 100%: 약 40%
 * - 건사료 + 간식·토퍼: 약 35%
 * - 건사료 + 화식/raw mix: 약 20% ← 핵심 target
 * - 화식/raw 100%: 약 5% (niche)
 *
 * # 시나리오 정의
 *   topper:  화식 30% + 사료 70% — "한 끼 영양 보강용 가볍게"
 *   mix50:   화식 50% + 사료 50% — "균형 잡힌 방식"
 *   mix70:   화식 70% + 사료 30% — "화식 위주"
 *   full:    화식 100% — "단독 급여, 최고 영양"
 *
 * # 안전 한도
 * 최소 비율 30% — 그 이하는 영양 균형 보장 어려움 (PMX 충족률 ↓).
 */

import type { BudgetTier } from './copy-strings'

/** 시나리오 키 */
export type FeedingScenario = 'topper' | 'mix50' | 'mix70' | 'full'

/** 시나리오별 화식 비율 (사용자 슬라이더 default) */
export const SCENARIO_HWASIK_RATIO: Record<FeedingScenario, number> = {
  topper: 0.30,
  mix50: 0.50,
  mix70: 0.70,
  full: 1.0,
} as const

/** 예산 응답 → default 시나리오 매핑 */
export const BUDGET_TO_SCENARIO: Record<BudgetTier, FeedingScenario> = {
  under_5000: 'topper',
  '5000_10000': 'mix50',
  '10000_15000': 'mix70',
  no_limit: 'full',
} as const

/** 예산 응답 → 일일 예산 anchor (원) */
export const BUDGET_TO_ANCHOR_KRW: Record<BudgetTier, number> = {
  under_5000: 4500,
  '5000_10000': 7500,
  '10000_15000': 12500,
  no_limit: 25000,
} as const

export interface MixCalculation {
  /** 적용된 화식 비율 (0.30~1.00) */
  hwasik_ratio: number
  /** 화식 일일 g */
  hwasik_g_per_day: number
  /** 사료 일일 g (350 kcal/100g 가정) */
  dry_food_g_per_day: number
  /** 시나리오 라벨 */
  scenario: FeedingScenario
}

/**
 * 견체 일일 MER + 화식 비율 → 화식·사료 일일 g 분배.
 *
 * @param dailyMerKcal 견체 일일 권장 kcal
 * @param hwasikRatio 화식 비율 (0.30~1.00). 미만은 0.30으로 clamp.
 * @param hwasikKcalPerG 화식 kcal/g (default 1.9 = 190 kcal/100g)
 * @param dryFoodKcalPerG 사료 kcal/g (default 3.5 = 350 kcal/100g, 일반 건사료)
 */
export function calculateMix(
  dailyMerKcal: number,
  hwasikRatio: number,
  hwasikKcalPerG = 1.9,
  dryFoodKcalPerG = 3.5,
): MixCalculation {
  // 최소 30% clamp — 그 이하는 영양 균형 보장 어려움
  const clampedRatio = Math.max(0.30, Math.min(1.0, hwasikRatio))

  const hwasikKcal = dailyMerKcal * clampedRatio
  const dryFoodKcal = dailyMerKcal * (1 - clampedRatio)

  return {
    hwasik_ratio: clampedRatio,
    hwasik_g_per_day: Math.round(hwasikKcal / hwasikKcalPerG),
    dry_food_g_per_day: Math.round(dryFoodKcal / dryFoodKcalPerG),
    scenario: ratioToScenario(clampedRatio),
  }
}

/** 비율 → 시나리오 키 변환 (UI 라벨용) */
function ratioToScenario(ratio: number): FeedingScenario {
  if (ratio < 0.40) return 'topper'
  if (ratio < 0.60) return 'mix50'
  if (ratio < 0.85) return 'mix70'
  return 'full'
}

/**
 * 예산 응답 → 시나리오 default 매핑.
 * 응답 없을 경우 mix50 (한국 시장 평균) 가정.
 */
export function defaultScenarioForBudget(
  budgetTier: BudgetTier | null | undefined,
): FeedingScenario {
  if (!budgetTier) return 'mix50'
  return BUDGET_TO_SCENARIO[budgetTier]
}

/**
 * 예산 응답이 견체 권장량 대비 너무 큰 경우 (over-budget) 감지.
 * 합리적 예산 권고 트리거.
 *
 * @returns true = 예산이 일일 권장량 대비 50% 이상 큼 (anchor가 비현실)
 */
export function isOverBudget(
  budgetTier: BudgetTier | null | undefined,
  recommendedDailyKrw: number,
): boolean {
  if (!budgetTier) return false
  const anchor = BUDGET_TO_ANCHOR_KRW[budgetTier]
  return anchor > recommendedDailyKrw * 1.5
}
