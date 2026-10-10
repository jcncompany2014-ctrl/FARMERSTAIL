/**
 * 상품정보 제공고시·원산지 — DB products 의 레시피 행(라벨 칸)이 정본이다(어드민 라벨 화면과 같은 칸).
 * 공개 키(anon)로 읽는다: 로그인 쿠키가 필요 없어 상품 페이지를 캐시해 둘 수 있고, 배합비(ingredients)는
 * 공개 조회가 막혀 있으므로(규칙164) 여기서 고르지도 않는다.
 * 못 읽으면 null — 화면은 지어낸 값 대신 "봉투 라벨을 확인해 주세요"를 쓴다(AGENTS 규칙1: 오류 ≠ 데이터 없음).
 */
import { createClient as createSupabase } from '@supabase/supabase-js'
import { RECIPE_DB_SLUG, type StoreRecipe } from './catalog'

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

export async function fetchRecipeLabel(recipe: StoreRecipe): Promise<RecipeLabel | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.from('products').select(COLS).eq('slug', RECIPE_DB_SLUG[recipe]).maybeSingle()
  if (error || !data) return null
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
