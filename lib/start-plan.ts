// 트랙B — /start 결과 'Your Plan'(FD식) 계산.
//
// 추천 레시피(알레르기 제외) + **실 하루 단가**(앱 분석과 동일한 buildFeedingPlan
// 모델, 화식 100g당 단가 = lib/pricing.ts 확정 구독가 평균). 전량 화식
// (맞춤 신선식 구독) 기준(customRatio:1).
//
// ★레시피는 web-recipes(공개 수준)만 — 영업비밀 배합%·프리믹스·원가 미노출.
// ★start-teaser.test 와 분리(여기서 feeding-plan import) — node:test 확장자
//   해석 영향 0(이 파일은 .test 아님).

import { calculateNutrition } from './nutrition.ts'
import { loadAutosignupDraft, type AutosignupDraft } from './autosignup-draft.ts'
import { draftToNutritionInput } from './start-teaser.ts'
import { buildFeedingPlan } from './feeding-plan.ts'
import { selectSafeRecipes, type WebRecipe } from './web-recipes.ts'

export type StartPlan = {
  /**
   * 추천 레시피(알레르기 제외) — Our Pick = [0]. 최대 3종.
   * ★알레르겐은 절대 추천 안 함 → 안전한 레시피가 없으면 **빈 배열**(가짜 폴백 금지).
   */
  recipes: WebRecipe[]
  /**
   * 입력한 알레르기로 추천 가능한 레시피가 0종인지 — true 면 결과뷰가
   * 레시피 카드 대신 "맞춤 상담" 안내로 분기한다(알레르겐 추천 방지).
   */
  noSafeRecipe: boolean
  /** 하루 단가(원, 전량 화식 기준·잠정 모델·구독가). */
  dailyKrw: number
}

export function computeStartPlan(
  draftArg?: AutosignupDraft | null,
): StartPlan | null {
  const draft = draftArg !== undefined ? draftArg : loadAutosignupDraft()
  const m = draftToNutritionInput(draft)
  if (!m) return null

  const nu = calculateNutrition(m.dogInfo, m.answers)

  // 알레르겐 제외 안전 레시피만(없으면 빈 배열 — 가짜 폴백으로 알레르겐 추천 금지).
  const recipes = selectSafeRecipes(m.allergies)

  // 전량 화식 기준 하루 단가 — 앱 분석과 같은 모델(잠정 단가).
  const plan = buildFeedingPlan({
    dogName: m.dogName,
    dailyMerKcal: Math.round(nu.mer),
    customRatio: 1,
  })
  const dailyKrw = plan.pricing.daily_krw

  return {
    recipes,
    noSafeRecipe: recipes.length === 0,
    dailyKrw,
  }
}
