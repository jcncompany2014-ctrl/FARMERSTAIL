/**
 * 화식 라인 메타 — **skuModel(SSOT) 파생 어댑터**.
 *
 * v2.0: 라인 키(basic/weight/skin/premium/joint)는 알고리즘 내부 식별자로
 * 유지하되, 실제 데이터(에너지·영양·페르소나·알레르기·라벨)는 전부
 * `skuModel.ts` 의 단백질 SSOT 에서 파생한다. 키 ↔ 단백질 매핑은
 * `LEGACY_LINE_TO_PROTEIN` (basic→duck, weight→chicken …).
 *
 * 즉 basic 라인은 오리(알레르기·장건강), weight 라인은 닭(체중관리·항염) 의
 * **레시피 값**을 그대로 노출 — 옛 "v2 보고서 이론값"이 아니라 최종
 * 마스터 레시피 v2.1 정합.
 */
import type { FoodLine, FoodLineMeta } from './types.ts'
import {
  SKU_MODEL,
  ALL_PROTEINS,
  LEGACY_LINE_TO_PROTEIN,
  type ProteinKey,
} from './skuModel.ts'

/** 라인 iteration 순서 (안정). */
export const ALL_LINES: FoodLine[] = [
  'basic',
  'weight',
  'skin',
  'premium',
  'joint',
]

/**
 * 라인 메타 — skuModel 에서 파생. 각 라인 = 해당 단백질 SKU 의 레시피 단면.
 * crossReactWith / blockingAllergies / kcal / 프로파일 / 라벨 모두 SSOT.
 */
export const FOOD_LINE_META: Record<FoodLine, FoodLineMeta> = Object.fromEntries(
  ALL_LINES.map((line) => {
    const sku = SKU_MODEL[LEGACY_LINE_TO_PROTEIN[line]]
    const meta: FoodLineMeta = {
      line,
      name: sku.name,
      subtitle: sku.subtitle,
      mainProtein: sku.protein,
      blockingAllergies: sku.blockingAllergies,
      crossReactWith: sku.crossReactWith,
      benefit: sku.benefit,
      kcalPer100g: sku.profile.kcalPer100g,
      proteinPctDM: sku.profile.proteinPctDM,
      fatPctDM: sku.profile.fatPctDM,
      color: sku.color,
    }
    return [line, meta]
  }),
) as Record<FoodLine, FoodLineMeta>

/**
 * preferred_proteins(설문) → FoodLine. LEGACY 역매핑.
 * chicken→basic, duck→weight, salmon→skin, beef→premium, pork→joint.
 */
export const PROTEIN_TO_LINE: Record<string, FoodLine> = Object.fromEntries(
  ALL_PROTEINS.map((p) => [p, SKU_MODEL[p].legacyLine]),
)

export function getLineFat(
  line: FoodLine,
  override?: Record<string, { fatPctDM?: number } | undefined>,
): number {
  return override?.[line]?.fatPctDM ?? FOOD_LINE_META[line].fatPctDM
}

export function getLineProtein(
  line: FoodLine,
  override?: Record<string, { proteinPctDM?: number } | undefined>,
): number {
  return override?.[line]?.proteinPctDM ?? FOOD_LINE_META[line].proteinPctDM
}

export function getLineKcal(
  line: FoodLine,
  override?: Record<string, { kcalPer100g?: number } | undefined>,
): number {
  return override?.[line]?.kcalPer100g ?? FOOD_LINE_META[line].kcalPer100g
}

/**
 * 라인별 omega-3 / omega-6 / vitamin D — skuModel 프로파일 파생.
 * admin override(algorithm_food_lines DB) 우선, 없으면 이 fallback.
 * (omega 는 레시피 미검증 → USDA 추정, vitD 는 레시피 검증값 — skuModel 참조.)
 */
export const FOOD_LINE_NUTRITION_FALLBACK: Record<
  FoodLine,
  {
    omega3PctDM: number
    omega6PctDM: number
    vitaminDIuPer100gDM: number
  }
> = Object.fromEntries(
  ALL_LINES.map((line) => {
    const p: ProteinKey = LEGACY_LINE_TO_PROTEIN[line]
    const prof = SKU_MODEL[p].profile
    return [
      line,
      {
        omega3PctDM: prof.omega3PctDM,
        omega6PctDM: prof.omega6PctDM,
        vitaminDIuPer100gDM: prof.vitaminDIuPer100gDM,
      },
    ]
  }),
) as Record<FoodLine, { omega3PctDM: number; omega6PctDM: number; vitaminDIuPer100gDM: number }>

/**
 * 결정된 라인 mix 의 가중평균 kcal/100g 으로 일일 g 재계산.
 *
 * 레시피 v2.1 sheet7: basic(닭)1.30 / weight(오리)1.50 / joint(돼지)1.40 /
 * premium(소)1.60 가중평균. compute API + nextBox + 분석 페이지 동일 룰.
 */
export function dailyGramsFromMix(
  lineRatios: Record<FoodLine, number>,
  dailyKcal: number,
  override?: Record<string, { kcalPer100g?: number } | undefined>,
): number {
  let total = 0
  let weightSum = 0
  for (const line of ALL_LINES) {
    const ratio = lineRatios[line] ?? 0
    if (ratio <= 0) continue
    weightSum += ratio
    const kcal100 =
      override?.[line]?.kcalPer100g ?? FOOD_LINE_META[line].kcalPer100g
    total += ((ratio * dailyKcal) / kcal100) * 100
  }
  // audit #30: 모든 라인 0 시 silent 0 반환 위험 → 평균 1.45 kcal/g fallback.
  if (weightSum <= 0) {
    return Math.round(dailyKcal / 1.45)
  }
  return Math.round(total)
}
