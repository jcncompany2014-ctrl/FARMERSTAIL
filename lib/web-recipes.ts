// 웹 결과 'Your Plan' 레시피 카드용 — **마케팅 공개 수준만**(이름·컨셉·주재료·칼로리).
//
// 출처: 파머스테일 화식 마스터 레시피 v3.1(대외비). 본 파일은 그 문서의 **공개
// 가능한 단면만** 담는다 — 사장님 결정(2026-06-16) "레시피명+주재료만".
// ★절대 미포함(영업비밀): 배합 %·프리믹스 사양(CAS·활성성분)·원가/마진·수율.
//
// 활성 4 SKU(성견 유지용). 연어는 추후 시니어 라인이라 제외.
// 공통: AAFCO+FEDIAF+NIAS 3중 표준 동시충족 +15% 안전마진, 자연 원물 우선,
//       심장(자연 타우린)·연어유(오메가3) 포함.

export type WebRecipe = {
  /** 메인 단백질 키 — 설문 allergy 키와 정합(추천 필터용). */
  protein: 'chicken' | 'duck' | 'pork' | 'beef'
  /** 레시피명 */
  name: string
  /** 한 줄 컨셉/페르소나 */
  concept: string
  /** 추천 견 */
  recommendedFor: string
  /** 주재료(공개 수준 — 메인 부위 + 간·심장 + 컨셉 토핑 + 채소·곡물). % 미노출. */
  mainIngredients: string
  /** 완성품 칼로리 kcal/100g (v3.1) */
  kcalPer100g: number
}

export const WEB_RECIPES: Record<WebRecipe['protein'], WebRecipe> = {
  chicken: {
    protein: 'chicken',
    name: '닭 화식',
    concept: '체중관리·항염',
    recommendedFor: '다이어트·실내견',
    mainIngredients: '닭가슴살 · 간 · 심장 · 강황 · 당근 · 현미',
    kcalPer100g: 168,
  },
  duck: {
    protein: 'duck',
    name: '오리 화식',
    concept: '알러지·장건강',
    recommendedFor: '일반·민감견',
    mainIngredients: '오리안심 · 간 · 심장 · 사과 · 단호박 · 현미',
    kcalPer100g: 190,
  },
  pork: {
    protein: 'pork',
    name: '돼지 화식',
    concept: '기호성·신경 케어',
    recommendedFor: '노견 · 입 짧은 아이',
    mainIngredients: '돼지안심 · 간 · 심장 · 무 · 당근 · 현미',
    kcalPer100g: 177,
  },
  beef: {
    protein: 'beef',
    name: '소 화식',
    concept: '활력·프리미엄',
    recommendedFor: '활동량 많은 아이',
    mainIngredients: '한우목심 · 간 · 심장 · 블루베리 · 시금치 · 현미',
    kcalPer100g: 206,
  },
}

// 추천 우선순위 — start-teaser PROTEIN_ORDER(duck·salmon·lamb·beef·chicken·pork)에서
// SKU 있는 4종만(연어·양 제외). Our Pick = 알레르기 제외 후 첫 번째.
export const WEB_RECIPE_ORDER: WebRecipe['protein'][] = [
  'duck',
  'beef',
  'chicken',
  'pork',
]

/**
 * 알레르기 단백질을 제외한 추천 레시피(우선순위순, 최대 max종).
 *
 * ★안전 규칙: 알레르겐은 **절대 추천하지 않는다**. 안전한 레시피가 하나도 없으면
 *   (예: 닭·소·오리·돼지 4종 모두 알레르기) **빈 배열**을 반환한다 — 가짜 폴백으로
 *   알레르겐을 추천하지 않는다. 호출부는 빈 경우 "맞춤 상담" 안내로 분기할 것.
 * salmon·lamb 등 SKU 없는 단백질 알레르기는 후보 4종에 영향 없음(애초에 후보 아님).
 */
export function selectSafeRecipes(allergies: string[], max = 3): WebRecipe[] {
  const blocked = new Set(allergies)
  return WEB_RECIPE_ORDER.filter((p) => !blocked.has(p))
    .map((p) => WEB_RECIPES[p])
    .slice(0, max)
}
