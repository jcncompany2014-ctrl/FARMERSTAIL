/**
 * 웹 가게(단품) 상품표 — 2026-10-10 웹 리뉴얼(docs/WEB_STORE_RENEWAL_PLAN_2026_10.md §4).
 *
 * 사장님 10/10: 웹은 '단품 가게', 맞춤·정기배송은 앱. 숫자는 웹 시안 그대로 —
 * 500g = 100g 팩 5개(정가) · 1kg = 100g 팩 10개(5% 할인) · 4종 체험팩(4종 100g씩) 19,900원.
 *
 * # 왜 DB products 의 화식 4행을 쓰지 않나
 * 그 4행의 price·sale_price 는 **100g 당 정가·구독가**이고 정기배송 청구가 그 값을 그대로 쓴다(§4.3-1).
 * 500g 단품가를 거기 넣으면 정기배송 금액이 깨진다. 그래서 단품 가격은 여기(코드)가 정본이고,
 * 정가의 출처는 정기배송과 같은 lib/pricing(SKU_PRICING)이다 — 같은 숫자를 두 곳에 적지 않는다.
 * 주문 품목(order_items)은 레시피 행(products)을 가리키고 단품 이름·단가는 이 표에서 넣는다(서버가 계산).
 *
 * 웹에서만 쓴다. 앱은 단품을 팔지 않는다(웹/앱 역할 분리, 기획서 §2).
 */
import { SKU_MODEL } from '../personalization/skuModel.ts'
import { SKU_PRICING, SUBSCRIPTION_DISCOUNT_PCT } from '../pricing.ts'
import { RECIPE_INGREDIENTS } from '../recipe-ingredients.ts'
import { eulReul, josa, waGwa } from '../korean.ts'

export type StoreRecipe = 'chicken' | 'duck' | 'pork' | 'beef'
/** 진열 순서(시안) — 닭고기 · 오리고기 · 흑돼지 · 한우. */
export const STORE_RECIPES: readonly StoreRecipe[] = ['chicken', 'duck', 'pork', 'beef']

/** 팩 하나 = 100g. 해동 후 냉장 3일 규칙·소형견 곁들임 양과 맞춘 표준 팩(기획서 D4). */
export const PACK_G = 100
/** 1kg 할인율 — 500g×2 보다 5% 싸게. 정기배송(15%)보다 비싸야 앱으로 갈 이유가 남는다(D5). */
export const ONE_KG_DISCOUNT_PCT = 5
/** 4종 체험팩 가격(시안, 사장님 10/10 "시안 숫자 그대로"). */
export const TRIAL_PRICE = 19_900

/** 웹 레시피 색(팩 라벨 띠) — 웹 시안 정본. 앱 화면은 파우치 몸통 색(lib/design/tokens POUCH)을 쓴다. */
export const RECIPE_BAND: Record<StoreRecipe, string> = {
  chicken: '#E8952F',
  duck: '#2F8F8B',
  pork: '#2E3338',
  beef: '#C63D2A',
}

/** 화면에 쓰는 이름 — 짧은 이름(닭고기)과 상품 이름(닭고기 화식). */
export const RECIPE_NAME: Record<StoreRecipe, string> = {
  chicken: '닭고기',
  duck: '오리고기',
  pork: '흑돼지',
  beef: '한우',
}
export const RECIPE_PRODUCT_NAME: Record<StoreRecipe, string> = {
  chicken: '닭고기 화식',
  duck: '오리고기 화식',
  pork: '흑돼지 화식',
  beef: '한우 화식',
}
/** 정기배송·DB 의 레시피 행 slug(products.slug) — 주문 품목이 가리키는 행. */
export const RECIPE_DB_SLUG: Record<StoreRecipe, string> = {
  chicken: SKU_MODEL.chicken.slug,
  duck: SKU_MODEL.duck.slug,
  pork: SKU_MODEL.pork.slug,
  beef: SKU_MODEL.beef.slug,
}

export function kcalPer100g(r: StoreRecipe): number {
  return SKU_MODEL[r].profile.kcalPer100g
}
export function per100gPrice(r: StoreRecipe): number {
  return SKU_PRICING[r].listPer100g
}
/** 앱 정기배송 100g 값(−15%) — "매일 먹인다면" 줄에만. */
export function subscriptionPer100g(r: StoreRecipe): number {
  return SKU_PRICING[r].subPer100g
}

/** 원재료(정본 lib/recipe-ingredients — 이름만, 배합비 없음). */
function ingredientsOf(r: StoreRecipe) {
  const ing = RECIPE_INGREDIENTS[SKU_MODEL[r].legacyLine]
  if (!ing) throw new Error(`원재료가 없는 레시피: ${r}`)
  return ing
}
/** '닭간' → '간' — 카드 한 줄에서 앞의 고기 이름을 반복하지 않는다. */
function organShort(organ: string): string {
  return organ.replace(/^(닭|오리|흑돼지|한우)/, '')
}
/** 카드 한 줄 — 고기 부위(메인·간·염통). 예: 닭가슴살·간·염통 */
export function meatLine(r: StoreRecipe): string {
  const ing = ingredientsOf(r)
  return [ing.main, ...ing.organs.map(organShort)].join('·')
}
/** 컨셉 토핑 2종. 예: 브로콜리·블루베리 */
export function toppingLine(r: StoreRecipe): string {
  return ingredientsOf(r).toppings.join('·')
}
/** 원재료 전체(이름만). */
export function fullIngredients(r: StoreRecipe): string[] {
  const ing = ingredientsOf(r)
  return [ing.main, ...ing.organs, ...ing.veg, ...ing.toppings, ...ing.base]
}

/** 상품 상세 한 줄. 예: 닭가슴살에 염통과 간까지, 브로콜리와 블루베리를 더했어요 */
export function recipeIntro(r: StoreRecipe): string {
  const ing = ingredientsOf(r)
  const [t1, t2] = ing.toppings
  return `${ing.main}에 염통과 간까지, ${waGwa(t1)} ${eulReul(t2)} 더했어요`
}

/**
 * "이런 아이에겐 다른 레시피를 권해요" — 이 레시피를 먹고 탈이 났다면 고를 다른 레시피 둘.
 * 정본 SKU_MODEL 의 알레르기·교차 반응으로 거른다: 이 레시피의 원료(차단·교차)와 겹치는 레시피, 이 레시피 원료와
 * 교차 반응하는 레시피는 빼고, 알레르기 보고가 적은 순(muellerAllergyRate)으로 둘.
 * 예: 닭고기 → 오리는 닭과 교차 반응이라 빼고 흑돼지·한우.
 */
export function alternativeRecipes(r: StoreRecipe): StoreRecipe[] {
  const me = SKU_MODEL[r]
  const mine = new Set([...me.blockingAllergies, ...me.crossReactWith])
  return STORE_RECIPES.filter((o) => o !== r)
    .filter((o) => {
      const other = SKU_MODEL[o]
      if (other.blockingAllergies.some((a) => mine.has(a))) return false
      if (other.crossReactWith.some((a) => me.blockingAllergies.includes(a))) return false
      return true
    })
    .sort((a, b) => SKU_MODEL[a].muellerAllergyRate - SKU_MODEL[b].muellerAllergyRate)
    .slice(0, 2)
}
export function alternativeAdvice(r: StoreRecipe): string | null {
  const alts = alternativeRecipes(r)
  if (alts.length === 0) return null
  const names = alts.map((o) => RECIPE_NAME[o])
  const list = names.length === 2 ? `${josa(names[0]!, '이나', '나')} ${names[1]}` : names[0]
  return `${eulReul(RECIPE_NAME[r])} 먹고 탈이 난 적 있는 아이라면 ${list} 레시피를 골라 주세요.`
}

export type StoreSize = '500g' | '1kg'
export const STORE_SIZES: readonly StoreSize[] = ['500g', '1kg']
export const SIZE_PACKS: Record<StoreSize, number> = { '500g': 5, '1kg': 10 }

export type StoreItemId = `${StoreRecipe}-${StoreSize}` | 'trial-4set'

export interface StoreItem {
  id: StoreItemId
  kind: 'recipe' | 'trial'
  /** 레시피 단품이면 그 레시피, 체험팩이면 null. */
  recipe: StoreRecipe | null
  size: StoreSize | null
  /** 주문서·영수증 이름. 예: 닭고기 화식 500g · 4종 체험팩 */
  name: string
  /** 100g 팩 개수. */
  packs: number
  grams: number
  /** 판매가(원). */
  price: number
  /** 할인 전 값(1kg 은 500g×2). 할인이 없으면 price 와 같다. */
  listPrice: number
  /** 상품 페이지 주소 조각 — /store/<slug>. */
  slug: string
}

function round10(n: number): number {
  return Math.round(n / 10) * 10
}

function recipeItem(r: StoreRecipe, size: StoreSize): StoreItem {
  const p500 = SKU_PRICING[r].listPack500g
  const listPrice = size === '500g' ? p500 : p500 * 2
  const price = size === '500g' ? p500 : round10(listPrice * (1 - ONE_KG_DISCOUNT_PCT / 100))
  return {
    id: `${r}-${size}`,
    kind: 'recipe',
    recipe: r,
    size,
    name: `${RECIPE_PRODUCT_NAME[r]} ${size}`,
    packs: SIZE_PACKS[size],
    grams: SIZE_PACKS[size] * PACK_G,
    price,
    listPrice,
    slug: r,
  }
}

export const TRIAL_ITEM: StoreItem = {
  id: 'trial-4set',
  kind: 'trial',
  recipe: null,
  size: null,
  name: '4종 체험팩',
  packs: STORE_RECIPES.length,
  grams: STORE_RECIPES.length * PACK_G,
  price: TRIAL_PRICE,
  listPrice: STORE_RECIPES.reduce((s, r) => s + per100gPrice(r), 0),
  slug: 'trial',
}

export const STORE_ITEMS: Record<StoreItemId, StoreItem> = Object.fromEntries([
  ...STORE_RECIPES.flatMap((r) => STORE_SIZES.map((s) => recipeItem(r, s))),
  TRIAL_ITEM,
].map((it) => [it.id, it])) as Record<StoreItemId, StoreItem>

export function isStoreItemId(v: unknown): v is StoreItemId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(STORE_ITEMS, v)
}
export function storeItem(id: StoreItemId): StoreItem {
  return STORE_ITEMS[id]
}
export function recipeFromSlug(slug: string): StoreRecipe | null {
  return (STORE_RECIPES as readonly string[]).includes(slug) ? (slug as StoreRecipe) : null
}

/** 정기배송으로 같은 양을 받으면 얼마 덜 내나(원) — "같은 양을 앱 정기배송으로 받으면 ○원 덜 내요". */
export function subscriptionSaving(item: StoreItem): number {
  if (item.kind !== 'recipe' || !item.recipe) return 0
  const sub = subscriptionPer100g(item.recipe) * item.packs
  return Math.max(0, item.price - sub)
}
export { SUBSCRIPTION_DISCOUNT_PCT }

/** 사진(public/store) — 팩 스튜디오 사진(정사각)·실제 사진(3:2). 겉봉투 사진은 쓰지 않는다. */
export const RECIPE_STUDIO_IMG: Record<StoreRecipe, string> = {
  chicken: '/store/studio-chicken.webp',
  duck: '/store/studio-duck.webp',
  pork: '/store/studio-pork.webp',
  beef: '/store/studio-beef.webp',
}
export const RECIPE_REAL_IMG: Record<StoreRecipe, string> = {
  chicken: '/store/real-chicken.webp',
  duck: '/store/real-duck.webp',
  pork: '/store/real-pork.webp',
  beef: '/store/real-beef.webp',
}
