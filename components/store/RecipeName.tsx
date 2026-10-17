/**
 * 레시피 이름 한 덩이 — 큰 '치킨 레시피'(포스터 글꼴) 바로 옆에 훨씬 작은 '닭고기 화식'(사장님 2026-10-17).
 * 두 이름은 글자 바닥선을 맞춘다. 칸이 아주 좁으면 작은 이름만 다음 줄로 내려간다(큰 이름은 끊지 않는다).
 * stack: 2열 작은 카드처럼 폭이 늘 모자란 곳 — 레시피마다 줄바꿈이 들쭉날쭉하지 않게 처음부터 두 줄로 쌓는다.
 * as="h1" 이면 상품 상세 제목 — 검색·화면 읽기에는 "치킨 레시피 닭고기 화식"으로 읽힌다.
 */
import { RECIPE_PRODUCT_NAME, RECIPE_TITLE, type StoreRecipe } from '@/lib/store/catalog'

export default function RecipeName({
  recipe,
  size = 22,
  as: Tag = 'span',
  subColor = '#595959',
  stack = false,
}: {
  recipe: StoreRecipe
  /** 큰 이름 글자 크기(px). 작은 이름은 그 0.55배(최소 13). */
  size?: number
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'strong'
  subColor?: string
  stack?: boolean
}) {
  const sub = Math.max(13, Math.round(size * 0.55))
  return (
    <Tag style={{ margin: 0, display: 'flex', flexDirection: stack ? 'column' : 'row', flexWrap: 'wrap', alignItems: stack ? 'flex-start' : 'baseline', columnGap: Math.round(size * 0.3), rowGap: 2, lineHeight: 1.1, fontWeight: 400 }}>
      <span className="d" style={{ fontSize: size, whiteSpace: 'nowrap' }}>
        {RECIPE_TITLE[recipe]}
      </span>
      {/* 본문 글꼴을 직접 적는다 — 가게 CSS 가 h1·h2 안 글자를 포스터 글꼴로 바꾼다(store.css .fts main h1). */}
      <span style={{ fontFamily: "var(--font-sans), 'Pretendard Variable', sans-serif", fontSize: sub, fontWeight: 700, color: subColor, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
        {RECIPE_PRODUCT_NAME[recipe]}
      </span>
    </Tag>
  )
}
