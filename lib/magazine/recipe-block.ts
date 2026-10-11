/**
 * 매거진 본문의 레시피 카드 자리 — 글에 한 줄로 `::레시피 오리` 처럼 쓴다(2026-10-11 매거진 기획 docs/MAGAZINE_PLAN_2026_10.md).
 * lib/markdown 이 이 표로 자리를 알아보고(어드민 미리보기엔 이름표만), 글 화면이 lib/magazine/recipe-card 로 가게 상품 카드를 그린다.
 * 의존성 없는 순수 표 — 어드민(클라이언트) 미리보기에서도 쓴다.
 */
export type MagazineRecipeKey = 'chicken' | 'duck' | 'pork' | 'beef' | 'trial'

export const MAGAZINE_RECIPE_KEYS: readonly MagazineRecipeKey[] = ['chicken', 'duck', 'pork', 'beef', 'trial']

const ALIASES: Record<string, MagazineRecipeKey> = {
  '닭': 'chicken',
  '닭고기': 'chicken',
  chicken: 'chicken',
  '오리': 'duck',
  '오리고기': 'duck',
  duck: 'duck',
  '흑돼지': 'pork',
  '돼지': 'pork',
  '돼지고기': 'pork',
  pork: 'pork',
  '한우': 'beef',
  '소': 'beef',
  '소고기': 'beef',
  beef: 'beef',
  '체험팩': 'trial',
  trial: 'trial',
}

/** 글쓴이가 적은 이름(닭·오리고기·체험팩·chicken …) → 카드 키. 모르는 이름이면 null(본문에 글자 그대로 남아 실수가 보인다). */
export function recipeBlockKey(raw: string): MagazineRecipeKey | null {
  return ALIASES[raw.trim().toLowerCase()] ?? null
}

/** 어드민 미리보기 이름표 — 글 화면에선 카드로 바뀐다. */
export const RECIPE_BLOCK_LABEL: Record<MagazineRecipeKey, string> = {
  chicken: '닭고기 화식',
  duck: '오리고기 화식',
  pork: '흑돼지 화식',
  beef: '한우 화식',
  trial: '4종 체험팩',
}
