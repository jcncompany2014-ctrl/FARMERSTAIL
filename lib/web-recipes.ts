// 상대 경로 + .ts — npm test(node --experimental-strip-types)는 별칭을 못 푼다
// (AGENTS.md 의 그 함정). 값 import 라 확장자도 필요하다.
import { SKU_MODEL } from './personalization/skuModel.ts'

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
  /**
   * 100g 당 kcal — **여기 적지 않는다.** SKU_MODEL(정본)에서 읽는다.
   *
   * ★2026-08-05: 웹은 v3.1 시절 값(닭115·오리120·돼지115·소120)을 들고 있었고
   *   앱 정본은 v4.0(닭130·오리125·돼지125·소145)이었다. FdRecipeSheet 가 그
   *   숫자를 웹 방문자에게 그대로 렌더했으니 **웹과 앱이 서로 다른 kcal 을
   *   말하고 있었다**("v4.0 전부 반영완료"에서 빠진 지점).
   *   같은 숫자를 두 곳에 적으면 갈라진다 — 이 저장소에서 여러 번 확인했다.
   */
  readonly kcalPer100g: number
}

const WEB_RECIPE_COPY: Record<WebRecipe['protein'], Omit<WebRecipe, 'kcalPer100g'>> = {
  chicken: {
    protein: 'chicken',
    name: '닭 화식',
    // '항염'은 의약품 효능 오인 표현이라 성분 표기로 쓴다(사료관리법 §13).
    concept: '체중관리·오메가3',
    recommendedFor: '다이어트·실내견',
    mainIngredients: '닭가슴살 · 간 · 심장 · 강황 · 당근 · 현미',
  },
  duck: {
    protein: 'duck',
    name: '오리 화식',
    concept: '알러지·장건강',
    recommendedFor: '일반·민감견',
    mainIngredients: '오리안심 · 간 · 심장 · 사과 · 단호박 · 현미',
  },
  pork: {
    protein: 'pork',
    name: '돼지 화식',
    concept: '기호성·신경 케어',
    recommendedFor: '노견 · 입 짧은 아이',
    mainIngredients: '흑돼지 뒷다리살 · 간 · 심장 · 무 · 당근 · 현미',
  },
  beef: {
    protein: 'beef',
    name: '소 화식',
    concept: '활력·프리미엄',
    recommendedFor: '활동량 많은 아이',
    mainIngredients: '한우목심 · 간 · 심장 · 블루베리 · 시금치 · 현미',
  },
}

/**
 * 추천 우선순위 — **start-teaser 의 PROTEIN_ORDER 와 같은 순서여야 한다.**
 *
 * ★2026-08-01 정렬 (전수 검수에서 발견): 예전 주석은 옛 순서
 * (duck·salmon·lamb·beef·chicken·pork)에서 파생됐다고 적었는데, start-teaser 가
 * 알레르기 유병률 오름차순(Mueller 2016: 오리 0.5% < 돼지 2% < 닭 15% < 소 34%)
 * 으로 바뀔 때 **여기만 안 따라왔다.** 그 결과 결과 화면 한 장 안에서
 * "추천 단백질: 오리·돼지" 라고 말하면서 카드는 오리·소·닭을 보여줬다 —
 * 돼지를 추천한다면서 돼지 카드가 없었다.
 * 두 배열이 같은 순서인지는 web-recipes.test 가 지킨다.
 */
export const WEB_RECIPE_ORDER: WebRecipe['protein'][] = [
  'duck',
  'pork',
  'chicken',
  'beef',
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

/**
 * 고객에게 보여줄 웹 레시피 — 문구는 위 표, **숫자는 SKU_MODEL 정본**.
 * 레시피 kcal 이 바뀌면 앱·웹이 함께 따라간다(따로 고칠 곳이 없다).
 */
export const WEB_RECIPES: Record<WebRecipe['protein'], WebRecipe> =
  Object.fromEntries(
    Object.entries(WEB_RECIPE_COPY).map(([k, v]) => [
      k,
      { ...v, kcalPer100g: SKU_MODEL[k as WebRecipe['protein']].profile.kcalPer100g },
    ]),
  ) as Record<WebRecipe['protein'], WebRecipe>
