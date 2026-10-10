/**
 * 웹 가게 급여량 계산기 — "500g 한 봉, 며칠 먹을까요?" · "하루에 얼마나 줄까요?" (웹 시안 홈·상품 상세).
 *
 * 웹의 양은 **일반 기준 예상치**다(기획서 §2 — 웹에는 '맞춤'이라는 말을 쓰지 않는다). 정확한 양은 앱 설문.
 * 기준 = 중성화한 성견·보통 활동량: 기초대사량(computeRer, 정본 lib/nutrition) × 성견 기본 계수(CAL.BASE_ADULT 1.4)
 * × 화식 비율 ÷ 레시피 kcal. 숫자를 따로 적지 않고 앱 계산과 같은 함수·상수를 쓴다.
 *
 * 검산(닭고기 130kcal, 곁들임 30%): 3kg 하루 52g·500g 9일 / 5kg 76g·6일 / 10kg 127g·3일 — 시안 표와 같다.
 */
import { computeRer } from '../nutrition.ts'
import { CAL } from '../calorie-v2/constants.ts'
import { kcalPer100g, per100gPrice, type StoreRecipe } from './catalog.ts'

export type FeedRatioKey = 'light' | 'half' | 'full'
export const FEED_RATIOS: readonly { key: FeedRatioKey; label: string; ratio: number }[] = [
  { key: 'light', label: '건사료에 곁들여서', ratio: 0.3 },
  { key: 'half', label: '반반', ratio: 0.5 },
  { key: 'full', label: '화식만', ratio: 1 },
]
/** 홈 계산기의 몸무게 버튼(시안). */
export const HOME_WEIGHTS: readonly number[] = [3, 5, 10]
export const MIN_WEIGHT_KG = 1
export const MAX_WEIGHT_KG = 40

export function ratioOf(key: FeedRatioKey): number {
  return FEED_RATIOS.find((r) => r.key === key)?.ratio ?? 0.3
}

/** 하루 필요 열량(kcal) — 중성화 성견·보통 활동량. */
export function dailyKcal(weightKg: number): number {
  return computeRer(weightKg) * CAL.BASE_ADULT
}

/** 하루 급여량(g, 소수 그대로 — 표시는 반올림). */
export function gramsPerDay(weightKg: number, recipe: StoreRecipe, ratio: number): number {
  return (dailyKcal(weightKg) * ratio) / (kcalPer100g(recipe) / 100)
}

/** 이 양(g)이면 며칠분 — 내림(약속보다 짧게 말한다). 최소 1. */
export function daysFor(totalGrams: number, perDayGrams: number): number {
  if (perDayGrams <= 0) return 0
  return Math.max(1, Math.floor(totalGrams / perDayGrams))
}

/** 하루 값(원) — 50원 단위 반올림. */
export function costPerDay(recipe: StoreRecipe, perDayGrams: number): number {
  return Math.round(((perDayGrams * per100gPrice(recipe)) / 100) / 50) * 50
}

/** 하루에 100g 팩 몇 개 — '¾팩' 같은 말로(시안 "100g 팩 ¾쯤"). */
export function packFractionLabel(perDayGrams: number): string {
  const packs = perDayGrams / 100
  const whole = Math.floor(packs)
  const rest = packs - whole
  const frac = rest < 0.125 ? '' : rest < 0.375 ? '¼' : rest < 0.625 ? '½' : rest < 0.875 ? '¾' : ''
  const w = rest >= 0.875 ? whole + 1 : whole
  if (w === 0 && !frac) return '100g 팩 조금'
  return `100g 팩 ${w > 0 ? w : ''}${frac}${w === 0 || frac ? '쯤' : '개'}`
}

/** 계산기 한 번에 — 화면이 쓰는 값 묶음. */
export function feedingSummary(weightKg: number, recipe: StoreRecipe, ratioKey: FeedRatioKey, totalGrams: number) {
  const w = Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, weightKg))
  const g = gramsPerDay(w, recipe, ratioOf(ratioKey))
  return {
    weightKg: w,
    gramsPerDay: Math.round(g),
    days: daysFor(totalGrams, g),
    costPerDay: costPerDay(recipe, g),
    packLabel: packFractionLabel(g),
  }
}
