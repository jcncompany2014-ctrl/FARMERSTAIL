/**
 * 매거진 카테고리 단추에 보일 것 — 공개 글이 1편 이상인 카테고리만(2026-10-13 토스 심사 준비, 규칙212).
 * 글이 0편인 카테고리를 누르면 빈 '준비 중' 화면이 나왔다 → 단추를 숨긴다.
 * publishedPosts 가 null = 글 조회 실패 → 글 수를 모른다. 0편으로 착각해 전부 숨기지 않고 지금처럼 다 보인다(AGENTS 규칙1).
 */
export function visibleMagazineCategories<C extends { id: string }>(
  categories: readonly C[],
  publishedPosts: readonly { category_id: string | null }[] | null,
): C[] {
  if (publishedPosts === null) return [...categories]
  const withPosts = new Set(publishedPosts.map((p) => p.category_id).filter((id): id is string => !!id))
  return categories.filter((c) => withPosts.has(c.id))
}
