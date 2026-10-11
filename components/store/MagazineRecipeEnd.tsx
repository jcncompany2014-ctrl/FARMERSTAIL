import type { MagazineRecipeKey } from '@/lib/magazine/recipe-block'
import { AppLine, RecipeCards } from './Editorial'

const RECIPES: readonly MagazineRecipeKey[] = ['chicken', 'duck', 'pork', 'beef']

/**
 * 매거진 글 끝 — 화식 4종 2칸 격자 + 앱 정기배송 한 줄(2026-10-11 매거진 기획). 카드·앱 줄은 읽을거리 화면 공통 부품(Editorial).
 * 본문에 `::레시피 …` 로 넣은 레시피를 앞에 세운다(글과 이어지는 것부터). 체험팩은 본문 카드로만 — 끝에서 같은 카드를 또 보이지 않는다.
 */
export default function MagazineRecipeEnd({ keys }: { keys: readonly MagazineRecipeKey[] }) {
  const mentioned = RECIPES.filter((k) => keys.includes(k))
  const order = [...mentioned, ...RECIPES.filter((k) => !mentioned.includes(k))]
  return (
    <section aria-labelledby="mag-recipe-title" style={{ padding: '52px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <h2 id="mag-recipe-title" className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
        {mentioned.length > 0 ? '이 글과 이어지는 화식' : '파머스테일 화식 4종'}
      </h2>
      <RecipeCards order={order} style={{ marginTop: 14 }} />
      <AppLine style={{ marginTop: 22 }} />
    </section>
  )
}
