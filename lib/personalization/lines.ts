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
      nameKo: sku.nameKo,
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
 * preferred_proteins(설문) → FoodLine. skuModel.legacyLine 파생(SSOT).
 * chicken→weight, duck→basic, salmon→skin, beef→premium, pork→joint.
 * (2026-07-03 정정: 이전 주석이 chicken/duck 라인을 뒤바꿔 적었음 —
 * 실제 매핑은 LEGACY_LINE_TO_PROTEIN 과 역방향으로 정확히 일치.)
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
 * 라인별 kcal = skuModel SSOT(2026-07-11 검정 확정: 닭·돼지 1.15 / 오리·소 1.20)
 * 가중평균. compute API + nextBox + 분석 페이지 동일 룰.
 */
/**
 * 한 라인의 하루 급여 g — **비율은 칼로리에 적용**한다.
 *
 * 박스의 50:50 은 '무게 반반'이 아니라 **'칼로리 반반'** 이다(사장님 2026-07-15
 * 확인). 레시피마다 kcal/100g 가 달라서(닭·돼지 115, 오리·소 120), 같은 칼로리를
 * 채우려면 밀도가 낮은 쪽이 더 무거워야 한다.
 *
 *   치킨50 + 한우50, 하루 184kcal →
 *     치킨 (0.5×184)/115×100 = 80.0g / 92kcal
 *     한우 (0.5×184)/120×100 = 76.7g / 92kcal
 *
 * 즉 칼로리는 같고 무게가 다르다. 가격은 팩 무게 기준(pricePerPack)이라 이 차이를
 * 자동으로 따라간다.
 *
 * ⚠️ `dailyGrams × 비율` 로 나누면 안 된다 — 그건 무게를 반반으로 쪼개는 것이라
 *    밀도가 다른 조합에서 실제 팩 무게와 어긋난다.
 */
export function lineDailyGrams(
  line: FoodLine,
  ratio: number,
  dailyKcal: number,
  override?: Record<string, { kcalPer100g?: number } | undefined>,
): number {
  if (ratio <= 0) return 0
  const kcal100 =
    override?.[line]?.kcalPer100g ?? FOOD_LINE_META[line].kcalPer100g
  if (!(kcal100 > 0)) return 0
  return ((ratio * dailyKcal) / kcal100) * 100
}

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
  // audit #30: 모든 라인 0 시 silent 0 반환 위험 → 4종 평균 1.175 kcal/g fallback
  // (2026-07-11 검정 확정: 닭·돼지 1.15, 오리·소 1.20).
  if (weightSum <= 0) {
    return Math.round(dailyKcal / 1.175)
  }
  return Math.round(total)
}
