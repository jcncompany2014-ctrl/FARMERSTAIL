/**
 * 5종 화식 라인 정의.
 *
 * 알고리즘 / UI 양쪽이 참조하는 SSOT. 새 라인 추가 시 여기와 firstBox.ts
 * 의 케어 목표 매핑만 손보면 됨. 실제 SKU (분량별 포장) 는 admin 이 별도로
 * products 테이블에 만들고, UI 가 line → SKU 조회.
 *
 * kcalPer100g 는 화식 5종 영양분석 보고서 v2 (2026-04) 의 이론값 평균.
 * 실제 batch 별 ±10% 변동 가능 — 박스 분량 산정 시 안전 마진 포함.
 */
import type { FoodLineMeta } from './types.ts'

/**
 * 라인별 영양 단면 (proteinPctDM, fatPctDM) 은 v2 batch 분석 평균.
 * 실제 batch 별 ±5% 변동 — 임상 룰 (췌장염 fat ceiling, IRIS CKD 단백질
 * 평가) 은 quantize 전에 합산해 안전 마진으로 간주.
 *
 * crossReactWith 는 한쪽이 알레르기일 때 다른 쪽도 위험 가능을 보호자에게
 * 알리는 chip — 차단은 안 함 (false positive 비용 큼).
 */
export const FOOD_LINE_META: Record<FoodLineMeta['line'], FoodLineMeta> = {
  basic: {
    line: 'basic',
    name: 'Basic',
    subtitle: '닭 · 균형식',
    mainProtein: 'chicken',
    blockingAllergies: ['닭·칠면조'],
    // 닭/칠면조 알레르기견의 ~30-50% 는 오리 cross-react 가능 (avian
    // livetin/parvalbumin 공유). 차단은 안 하되 chip 으로 알림.
    crossReactWith: [],
    benefit: '균형 잡힌 기본식, 모든 단계 적합',
    kcalPer100g: 215,
    proteinPctDM: 26,
    fatPctDM: 12,
    color: 'var(--terracotta)',
  },
  weight: {
    line: 'weight',
    name: 'Weight',
    subtitle: '오리 · 체중관리',
    mainProtein: 'duck',
    // 오리는 노블 프로틴 — 닭 알레르기 견의 옵션. 다만 오리 알레르기도 드물게
    // 보고됨. 사용자가 명시적으로 오리 표기하면 차단.
    // R92 (D7): 이전 빈 배열로 표기만 하고 실제 차단 누락 → Allergy.tsx UI
    // 의 "오리" 옵션 선택해도 오리 메인 SKU 추천되는 알레르기 사고 vector.
    // 키 이름은 ALLERGY_OPTIONS 의 "오리" 와 정확히 일치.
    blockingAllergies: ['오리'],
    crossReactWith: ['닭·칠면조'],
    benefit: '저칼로리 + 단호박, BCS 6+ 권장',
    kcalPer100g: 175,
    proteinPctDM: 28,
    fatPctDM: 8,
    color: 'var(--moss)',
  },
  skin: {
    line: 'skin',
    name: 'Skin',
    subtitle: '연어 · 피부·털',
    mainProtein: 'salmon',
    // R92 (D7): Allergy.tsx UI 가 "연어·생선" + "흰살생선" 두 옵션 노출. 어류
    // parvalbumin cross-reactivity (Bexley 2019) 로 한 어종 알레르기 견은 다른
    // 어종도 보수적으로 차단. "흰살생선" 만 단독 선택한 사용자가 연어 메인
    // SKU 추천받는 알레르기 사고 vector 차단.
    blockingAllergies: ['연어·생선', '흰살생선'],
    // 연어 알레르기 ↔ 다른 어류 cross-react (Bexley 2019 Vet Dermatol 30:25-e8).
    // chip 으로 "다른 어류 토퍼 주의" 알림.
    crossReactWith: [],
    benefit: '오메가-3 자체 공급, 피모 윤기',
    kcalPer100g: 225,
    proteinPctDM: 26,
    fatPctDM: 16,
    color: 'var(--gold)',
  },
  premium: {
    line: 'premium',
    name: 'Premium',
    subtitle: '소 · 활력·근육',
    mainProtein: 'beef',
    // R92 (D7): Allergy.tsx UI 가 "양고기" 옵션 노출. 소/양 BSA cross-react
    // (양 알레르기견의 ~30% 소 동시 양성). chip 알림만으로는 사용자가 양고기
    // 만 표기하면 소 메인 SKU 추천됨. 보수적 차단.
    blockingAllergies: ['소고기', '양고기'],
    // 소/양 BSA 부분 cross — 양고기 알레르기견은 소도 주의 (반대도).
    crossReactWith: ['양고기'],
    benefit: '헴 철분 + 아연, 활동량 많은 견',
    kcalPer100g: 195,
    proteinPctDM: 30,
    fatPctDM: 15,
    color: '#9B5B5B',
  },
  joint: {
    line: 'joint',
    name: 'Joint',
    subtitle: '돼지 · 관절·시니어',
    mainProtein: 'pork',
    blockingAllergies: ['돼지고기'],
    crossReactWith: [],
    benefit: 'B1·콜린 풍부, 인지·관절 케어',
    kcalPer100g: 200,
    proteinPctDM: 24,
    fatPctDM: 18,
    color: '#C97F8E',
  },
}

/** 모든 라인 — iteration 순서 안정. */
export const ALL_LINES: FoodLineMeta['line'][] = [
  'basic',
  'weight',
  'skin',
  'premium',
  'joint',
]

/**
 * 라인 메타 fetch — admin override (DB) 우선, 없으면 hardcoded fallback.
 *
 * 알고리즘은 input.foodLineMetaOverride 로 DB 결과를 받음. compute / cron
 * 호출자가 algorithm_food_lines 테이블을 fetch 해서 input 에 주입. 이 헬퍼는
 * 알고리즘 내부에서 라인 영양 값 (fatPctDM 등) 을 일관되게 가져올 때 사용.
 */
export function getLineFat(
  line: FoodLineMeta['line'],
  override?: Record<string, { fatPctDM?: number } | undefined>,
): number {
  return override?.[line]?.fatPctDM ?? FOOD_LINE_META[line].fatPctDM
}

export function getLineProtein(
  line: FoodLineMeta['line'],
  override?: Record<string, { proteinPctDM?: number } | undefined>,
): number {
  return override?.[line]?.proteinPctDM ?? FOOD_LINE_META[line].proteinPctDM
}

export function getLineKcal(
  line: FoodLineMeta['line'],
  override?: Record<string, { kcalPer100g?: number } | undefined>,
): number {
  return override?.[line]?.kcalPer100g ?? FOOD_LINE_META[line].kcalPer100g
}

/**
 * 라인별 omega-3 / omega-6 / vitamin D 추정값 (USDA FoodData Central + 화식
 * 70% moisture 변환). admin override (algorithm_food_lines DB) 우선, 없으면
 * 이 fallback. NULL 이면 nutrient panel 의 omega/vit D 검증 skip.
 *
 * 출처:
 *   - USDA FoodData Central (chicken/duck/salmon/beef/pork lean cooked)
 *   - NRC 2006 Nutrient Requirements ch.7 (Lipids)
 *   - Bauer (2008) JAVMA 233:680 — fatty acid review
 */
export const FOOD_LINE_NUTRITION_FALLBACK: Record<
  FoodLineMeta['line'],
  {
    omega3PctDM: number
    omega6PctDM: number
    vitaminDIuPer100gDM: number
  }
> = {
  basic:   { omega3PctDM: 0.17, omega6PctDM: 3.3, vitaminDIuPer100gDM: 17 },
  weight:  { omega3PctDM: 0.33, omega6PctDM: 3.3, vitaminDIuPer100gDM: 83 },
  // skin = 연어 — 자연 EPA+DHA 풍부. cardiac/atopy 가산 핵심.
  skin:    { omega3PctDM: 6.7,  omega6PctDM: 1.7, vitaminDIuPer100gDM: 1200 },
  premium: { omega3PctDM: 0.10, omega6PctDM: 1.7, vitaminDIuPer100gDM: 17 },
  joint:   { omega3PctDM: 0.17, omega6PctDM: 5.0, vitaminDIuPer100gDM: 167 },
}

/** preferred_proteins (survey) → FoodLine 매핑.
 * 알고리즘이 "닭 좋아함" → Basic 가산점 같은 결정에 사용. */
export const PROTEIN_TO_LINE: Record<string, FoodLineMeta['line']> = {
  chicken: 'basic',
  duck: 'weight',
  salmon: 'skin',
  beef: 'premium',
  pork: 'joint',
}

/**
 * 결정된 라인 mix 의 가중평균 kcal/100g 으로 일일 g 재계산.
 *
 * nutrition.ts 의 feed_g 는 평균 2.0 kcal/g 가정 — 실제 라인 mix 비율 따라
 * basic 2.15 / weight 1.75 / skin 2.25 / premium 1.95 / joint 2.0 가중평균
 * 적용해 정확도 ↑. compute API + nextBox + 분석 페이지 RecommendationBox
 * 모두 같은 룰로 통일.
 */
export function dailyGramsFromMix(
  lineRatios: Record<FoodLineMeta['line'], number>,
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
    total += (ratio * dailyKcal) / kcal100 * 100
  }
  // audit #30: 모든 라인 0 (호출처가 normalize 안 통과) 시 silent 0 반환 위험 →
  // 분석 페이지에 "0g 급여" 잘못 표시. 평균 2.0 kcal/g fallback.
  if (weightSum <= 0) {
    return Math.round(dailyKcal / 2.0)
  }
  return Math.round(total)
}
