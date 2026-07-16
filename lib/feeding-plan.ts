/**
 * Farmer's Tail — 통합 급여 계획 계산기 (Tier S 통합 entrypoint, 2026-05-20)
 *
 * 견체 정보 + 예산 응답 → 화식 비율 + 가격 framing 계산.
 *
 * # 2026-07-16 — 7종 SKU 사이즈 매핑 제거
 * 예전엔 여기서 `matchSku(hwasik_g)` 로 70/100/130/170/220/280/350 중 1팩을
 * 고르고 350g 초과는 콤보 2팩을 제안했다. **그 제품 모델은 이제 없다** —
 * 현행은 `lib/pricing.ts` 의 **500g 팩 · 100g 당 단가**이고 박스는 2종 레시피다.
 * 게다가 결과(`skuMatch`·`copy.combo_note`·`copy.sku_recommendation`)를 **읽는
 * 곳이 한 군데도 없었다**(유일 소비자 lib/start-plan.ts 는 pricing.daily_krw 만
 * 꺼내 간다). 계산해서 버리던 값이라 제거해도 동작은 그대로다.
 *
 * # 흐름
 *   [입력]
 *     - dailyMerKcal (lib/nutrition.ts calculateNutrition.mer 에서)
 *     - budgetTier (surveys.budget_tier)
 *     - hwasikRatio (사용자 슬라이더 직접 입력, 기본은 budget default)
 *   ↓
 *   [계산]
 *     1. defaultScenarioForBudget(budgetTier) — 슬라이더 default
 *     2. calculateMix(mer, ratio) — 화식·사료 g 분배
 *     3. 가격 framing (한 끼 / 하루 / 월)
 *   ↓
 *   [출력]
 *     FeedingPlan { mixCalc, pricing, scenario, copy }
 */

import {
  calculateMix,
  defaultScenarioForBudget,
  isOverBudget,
  SCENARIO_HWASIK_RATIO,
  type FeedingScenario,
  type MixCalculation,
} from './mix-feeding.ts'
import { AVG_SUB_KRW_PER_100G } from './pricing.ts'
import {
  ANALYSIS_COPY,
  PRICE_ANCHOR,
  withDogName,
  type BudgetTier,
} from './copy-strings.ts'

// ─────────────────────────────────────────────────────────────────────
// 💰 화식 100g 당 소비자가 (원) — lib/pricing.ts SSOT(확정 가격표)의
// 4종 구독가 평균. 분석 페이지 가격 framing(한 끼 / 하루 / 월 / 첫 박스 50%)의
// 모든 숫자가 이 값에서 파생된다. 급여량(g)은 강아지 MER 에서 정확히 계산.
//   한 끼 ≈ (하루 화식 g ÷ 100) × 이 값 ÷ 2끼
// 비교 문구("스타벅스 1잔" 등)는 lib/copy-strings.ts 의 PRICE_ANCHOR.
// 가격 변경은 lib/pricing.ts 에서 — 여기는 자동 추종.
// ─────────────────────────────────────────────────────────────────────
const HWASIK_KRW_PER_100G = AVG_SUB_KRW_PER_100G

export interface FeedingPlan {
  /** SKU 매핑 결과 */
  /** 화식·사료 비율 분배 */
  mixCalc: MixCalculation
  /** 가격 framing (원 단위) */
  pricing: {
    per_meal_krw: number
    daily_krw: number
    monthly_krw: number
    /** 비교 anchor 라벨 (예: "스타벅스 음료 1잔") */
    comparison_anchor: string
    /** 첫 박스 50% 할인 시 한 끼 가격 */
    first_box_per_meal_krw: number
  }
  /** 적용된 시나리오 */
  scenario: FeedingScenario
  /** UI에서 즉시 사용 가능한 카피 모음 */
  copy: {
    price_framing: string
    daily_total: string
    mix_default: string
    first_box_offer: string
    over_budget_hint: string | null
  }
}

export interface BuildFeedingPlanInput {
  /** 견 이름 (카피 인격화용) */
  dogName: string
  /** 일일 권장 kcal (calculateNutrition.mer) */
  dailyMerKcal: number
  /** 예산 응답 (설문 F1-1) */
  budgetTier?: BudgetTier | null
  /** 사용자 직접 입력 비율 (슬라이더). 미입력 시 budget default 사용. */
  customRatio?: number | null
  /**
   * 칼로리 v2 5단계(M9b) — 보호자 사료 라벨 kcal/100g (설문 신고값).
   * mix 시나리오의 건사료 g 을 실제 사료 열량으로 계산. 미입력 = 평균 350.
   */
  kibbleKcalPer100g?: number | null
}

/**
 * 통합 entrypoint — 모든 분석·구매 페이지에서 호출.
 *
 * @example
 *   const plan = buildFeedingPlan({
 *     dogName: '봉봉',
 *     dailyMerKcal: 311,
 *     budgetTier: '5000_10000',
 *   })
 *   // plan.copy.price_framing → "💚 한 끼 약 3,250원 (스타벅스 음료 1잔보다 적어요)"
 */
export function buildFeedingPlan(input: BuildFeedingPlanInput): FeedingPlan {
  const { dogName, dailyMerKcal, budgetTier, customRatio } = input

  // 1) 시나리오 결정 — customRatio 우선, 없으면 budget default
  const scenario = defaultScenarioForBudget(budgetTier)
  const ratio = customRatio ?? SCENARIO_HWASIK_RATIO[scenario]

  // 2) 화식·사료 분배 — 건사료 kcal 신고값 있으면 실제 열량으로 (M9b).
  const mixCalc = calculateMix(
    dailyMerKcal,
    ratio,
    undefined,
    input.kibbleKcalPer100g && input.kibbleKcalPer100g > 0
      ? input.kibbleKcalPer100g / 100
      : undefined,
  )

  // 3) SKU 사이즈 매핑

  // 4) 가격 framing
  const dailyKrw = Math.round((mixCalc.hwasik_g_per_day / 100) * HWASIK_KRW_PER_100G)
  const perMealKrw = Math.round(dailyKrw / 2)
  const monthlyKrw = dailyKrw * 30
  const firstBoxPerMealKrw = Math.round(perMealKrw / 2)
  const comparisonAnchor = PRICE_ANCHOR[budgetTier ?? '5000_10000']

  // 5) 카피 생성
  const overBudgetHint = isOverBudget(budgetTier, dailyKrw)
    ? withDogName(ANALYSIS_COPY.over_budget('○○', dailyKrw), dogName)
    : null

  const mixDefaultCopy = withDogName(
    ANALYSIS_COPY.mix_default[scenario]('○○'),
    dogName,
  )

  return {
    mixCalc,
    pricing: {
      per_meal_krw: perMealKrw,
      daily_krw: dailyKrw,
      monthly_krw: monthlyKrw,
      comparison_anchor: comparisonAnchor,
      first_box_per_meal_krw: firstBoxPerMealKrw,
    },
    scenario,
    copy: {
      price_framing: ANALYSIS_COPY.price_framing(perMealKrw, comparisonAnchor),
      daily_total: ANALYSIS_COPY.daily_total(dailyKrw, monthlyKrw),
      mix_default: mixDefaultCopy,
      first_box_offer: withDogName(
        ANALYSIS_COPY.first_box_offer(perMealKrw, firstBoxPerMealKrw),
        dogName,
      ),
      over_budget_hint: overBudgetHint,
    },
  }
}
