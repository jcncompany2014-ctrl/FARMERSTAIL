/**
 * 상품정보 제공고시·원산지 — DB products 의 레시피 행(라벨 칸)이 정본이다(어드민 라벨 화면과 같은 칸).
 * 공개 키(anon)로 읽는다: 로그인 쿠키가 필요 없어 상품 페이지를 캐시해 둘 수 있고, 배합비(ingredients)는
 * 공개 조회가 막혀 있으므로(규칙164) 여기서 고르지도 않는다.
 * 못 읽으면 null — 화면은 지어낸 값 대신 "봉투 라벨을 확인해 주세요"를 쓴다(AGENTS 규칙1: 오류 ≠ 데이터 없음).
 */
import { createClient as createSupabase } from '@supabase/supabase-js'
import { RECIPE_DB_SLUG, RECIPE_NAME, STORE_RECIPES, TRIAL_ITEM, TRIAL_PACK_G, type StoreRecipe } from './catalog.ts'

export type RecipeLabel = {
  id: string
  slug: string
  isActive: boolean
  origin: string | null
  manufacturer: string | null
  manufacturerAddress: string | null
  manufactureDatePolicy: string | null
  shelfLifeDays: number | null
  storageMethod: string | null
  petFoodClass: string | null
  certifications: string[]
  countryOfPackaging: string | null
  sku: string | null
  allergens: string[]
}

const COLS =
  'id, slug, is_active, origin, manufacturer, manufacturer_address, manufacture_date_policy, shelf_life_days, storage_method, pet_food_class, certifications, country_of_packaging, sku, allergens'

type LabelRow = {
  id: string
  slug: string
  is_active: boolean | null
  origin: string | null
  manufacturer: string | null
  manufacturer_address: string | null
  manufacture_date_policy: string | null
  shelf_life_days: number | null
  storage_method: string | null
  pet_food_class: string | null
  certifications: string[] | null
  country_of_packaging: string | null
  sku: string | null
  allergens: string[] | null
}

function toLabel(data: LabelRow): RecipeLabel {
  return {
    id: data.id,
    slug: data.slug,
    isActive: !!data.is_active,
    origin: data.origin,
    manufacturer: data.manufacturer,
    manufacturerAddress: data.manufacturer_address,
    manufactureDatePolicy: data.manufacture_date_policy,
    shelfLifeDays: data.shelf_life_days,
    storageMethod: data.storage_method,
    petFoodClass: data.pet_food_class,
    certifications: data.certifications ?? [],
    countryOfPackaging: data.country_of_packaging,
    sku: data.sku,
    allergens: data.allergens ?? [],
  }
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function fetchRecipeLabel(recipe: StoreRecipe): Promise<RecipeLabel | null> {
  const supabase = anonClient()
  if (!supabase) return null
  const { data, error } = await supabase.from('products').select(COLS).eq('slug', RECIPE_DB_SLUG[recipe]).maybeSingle()
  if (error || !data) return null
  return toLabel(data as LabelRow)
}

/**
 * 레시피 4종 라벨 한 번에 — 체험팩(4종 50g씩) 제공고시용. 조회 실패이거나 한 종이라도 없으면 null
 * (반쪽 제공고시를 내보내지 않는다 — 화면은 "팩 라벨을 확인해 주세요").
 */
export async function fetchRecipeLabels(): Promise<Record<StoreRecipe, RecipeLabel> | null> {
  const supabase = anonClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('products')
    .select(COLS)
    .in('slug', STORE_RECIPES.map((r) => RECIPE_DB_SLUG[r]))
  if (error || !data) return null
  const bySlug = new Map((data as LabelRow[]).map((row) => [row.slug, toLabel(row)]))
  const out = {} as Record<StoreRecipe, RecipeLabel>
  for (const r of STORE_RECIPES) {
    const l = bySlug.get(RECIPE_DB_SLUG[r])
    if (!l) return null
    out[r] = l
  }
  return out
}

/** 체험팩 내용량에 쓰는 짧은 이름 — 닭·오리·흑돼지·한우. */
const SHORT: Record<StoreRecipe, string> = { chicken: '닭', duck: '오리', pork: '흑돼지', beef: '한우' }

/**
 * 네 레시피의 같은 칸 → 한 줄. 넷이 같으면 한 번만, 다르면 같은 값끼리 묶어 레시피별로("닭고기·오리고기: …" 줄바꿈).
 * 넷 다 비었으면 null(그 줄을 뺀다). 일부만 비었으면 그 레시피는 "팩 라벨 기준".
 */
function byRecipe(labels: Record<StoreRecipe, RecipeLabel>, pick: (l: RecipeLabel) => string | null): string | null {
  const vals = STORE_RECIPES.map((r) => ({ r, v: pick(labels[r])?.trim() || null }))
  if (vals.every((x) => x.v === null)) return null
  const groups = new Map<string | null, StoreRecipe[]>()
  for (const { r, v } of vals) groups.set(v, [...(groups.get(v) ?? []), r])
  if (groups.size === 1) return vals[0]!.v
  return [...groups]
    .map(([v, rs]) => `${rs.map((r) => RECIPE_NAME[r]).join('·')}: ${v ?? '팩 라벨 기준'}`)
    .join('\n')
}

/** 알레르기 정보 합집합 — 순서는 레시피마다의 n번째 항목끼리 먼저(닭고기·오리고기·돼지고기·소고기 → 어류(연어유)). */
export function unionAllergens(labels: Record<StoreRecipe, RecipeLabel>): string[] {
  const out: string[] = []
  const longest = Math.max(0, ...STORE_RECIPES.map((r) => labels[r].allergens.length))
  for (let i = 0; i < longest; i++) {
    for (const r of STORE_RECIPES) {
      const a = labels[r].allergens[i]?.trim()
      if (a && !out.includes(a)) out.push(a)
    }
  }
  return out
}

const won = (n: number) => n.toLocaleString('ko-KR')

/**
 * 4종 체험팩 상품정보 제공고시 줄(규칙211) — 상세 화면이 없는 체험팩 탭에 상품 상세와 같은 칸을 둔다.
 * 값은 레시피 4종의 DB 라벨에서(지어내지 않는다), 내용량·가격은 상품표(catalog) 정본에서.
 */
export function trialNoticeRows(labels: Record<StoreRecipe, RecipeLabel>, opts: { phone: string }): [string, string][] {
  const certs = STORE_RECIPES.filter((r) => labels[r].certifications.length > 0).map(
    (r) => `${RECIPE_NAME[r]}: ${labels[r].certifications.join(' · ')}`,
  )
  const skus = STORE_RECIPES.filter((r) => labels[r].sku).map((r) => `${RECIPE_NAME[r]} ${labels[r].sku}`)
  const allergens = unionAllergens(labels)
  const rows: [string, string | null][] = [
    ['제품명', TRIAL_ITEM.name],
    ['내용량', `${TRIAL_PACK_G}g × ${STORE_RECIPES.length}팩(${STORE_RECIPES.map((r) => SHORT[r]).join('·')} 각 1팩)`],
    ['가격', `${won(TRIAL_ITEM.price)}원`],
    ['사료의 종류', byRecipe(labels, (l) => l.petFoodClass)],
    ['원산지', byRecipe(labels, (l) => l.origin)],
    ['제조원', byRecipe(labels, (l) => [l.manufacturer, l.manufacturerAddress].filter(Boolean).join(' · ') || null)],
    ['제조연월일', byRecipe(labels, (l) => l.manufactureDatePolicy)],
    ['유통기한', byRecipe(labels, (l) => (l.shelfLifeDays ? `제조일부터 냉동 ${l.shelfLifeDays}일` : null))],
    ['보관 방법', byRecipe(labels, (l) => l.storageMethod)],
    ['알레르기 정보', allergens.length ? allergens.join(', ') : null],
    ['인증·원료', certs.length ? certs.join('\n') : null],
    ['포장 국가', byRecipe(labels, (l) => l.countryOfPackaging)],
    ['상품 번호', skus.length ? skus.join(' · ') : null],
    ['고객센터', opts.phone],
  ]
  return rows.filter((row): row is [string, string] => !!row[1])
}
