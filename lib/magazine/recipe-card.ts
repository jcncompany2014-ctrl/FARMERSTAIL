/**
 * 매거진 글의 레시피 카드 — 본문 자리(`::레시피 오리` → lib/markdown 의 md-recipe)와 글 끝 '이어지는 화식'이 같이 쓴다.
 * 이름·부위·가격·사진은 가게 정본(lib/store/catalog) 그대로 — 글에 숫자를 적어 두지 않아 값이 바뀌어도 낡지 않는다.
 * 카드는 가게 상품 화면(/store/…)으로 간다. 웹 결제가 막혀 있으면(규칙177) 그 화면이 스마트스토어를 안내한다.
 */
import { RECIPE_NAME, RECIPE_STUDIO_IMG, TRIAL_ITEM, TRIAL_PACK_G, meatLine, storeItem, type StoreRecipe } from '../store/catalog.ts'
import { MAGAZINE_RECIPE_KEYS, type MagazineRecipeKey } from './recipe-block.ts'

const won = (n: number) => n.toLocaleString('ko-KR')

export type MagazineRecipeCard = { key: MagazineRecipeKey; href: string; img: string; name: string; sub: string; price: string }

export function magazineRecipeCard(key: MagazineRecipeKey): MagazineRecipeCard {
  if (key === 'trial') {
    return { key, href: '/store?tab=trial', img: RECIPE_STUDIO_IMG.chicken, name: '4종 체험팩', sub: `네 가지 맛을 ${TRIAL_PACK_G}g씩`, price: `${won(TRIAL_ITEM.price)}원` }
  }
  const r: StoreRecipe = key
  return { key, href: `/store/${r}`, img: RECIPE_STUDIO_IMG[r], name: `${RECIPE_NAME[r]} 화식`, sub: meatLine(r), price: `500g ${won(storeItem(`${r}-500g`).price)}원` }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CHEVRON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'

const SLOT_RE = new RegExp(`<div class="md-recipe" data-recipe="(${MAGAZINE_RECIPE_KEYS.join('|')})">[^<]*</div>`, 'g')

/**
 * 본문 HTML(renderMarkdown 결과)의 레시피 카드 자리를 실제 카드로 바꾸고, 글에 쓰인 레시피를 나온 순서대로 돌려준다
 * (글 끝 '이어지는 화식'이 그 순서로 보여 준다). 스타일은 글 화면의 POST_CSS(.ftb-card).
 */
export function fillRecipeCards(html: string): { html: string; keys: MagazineRecipeKey[] } {
  const keys: MagazineRecipeKey[] = []
  const out = html.replace(SLOT_RE, (_m, k: string) => {
    const c = magazineRecipeCard(k as MagazineRecipeKey)
    if (!keys.includes(c.key)) keys.push(c.key)
    return (
      `<a class="ftb-card" href="${esc(c.href)}">` +
      `<img src="${esc(c.img)}" alt="" width="72" height="72" loading="lazy" />` +
      `<span class="ftb-card-t"><strong class="d">${esc(c.name)}</strong><span>${esc(c.sub)}</span><b>${esc(c.price)}</b></span>` +
      CHEVRON +
      `</a>`
    )
  })
  return { html: out, keys }
}
