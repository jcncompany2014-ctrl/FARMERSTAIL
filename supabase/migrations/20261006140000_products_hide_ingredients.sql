-- products.ingredients(배합비 %)를 공개 조회에서 뺀다 (2026-10-06).
--
-- # 왜
-- products.ingredients 에 화식 4종(chicken-basic·duck-weight·pork-joint·beef-premium)의 배합비가
-- 들어 있다("닭가슴살 53.71%, 닭염통 7.96%, …"). 배합비는 영업비밀이고, 볼 수 있는 곳은 어드민
-- 라벨 화면(/admin/label/[sku])뿐이어야 한다(lib/recipe-ingredients.ts 머리 주석).
-- 그런데 표 권한이 Supabase 기본값(anon·authenticated 에 표 전체 SELECT)이고, RLS 정책은
-- "Anyone can view active products (is_active = true)" 라서 **공개 anon 키로 REST 조회하면 누구나
-- 배합비를 읽었다**(2026-10-06 운영 DB 실측: has_column_privilege('anon', …, 'ingredients') = true).
-- RLS 는 행을 거르지 칸을 거르지 않는다 — 칸은 권한으로만 막힌다(AGENTS 규칙3).
--
-- # 어떻게
-- 표 단위 SELECT 를 회수하고, ingredients 를 뺀 34칸만 칸 단위로 다시 준다.
-- INSERT·UPDATE·DELETE 권한은 손대지 않는다(RLS "Admins can manage products" 가 관리자만 통과).
-- 어드민 화면은 isAdmin 확인 뒤 service_role(createAdminClient)로 읽는다 — service_role 은 표 권한 그대로.
-- 관리자도 authenticated 역할로는 ingredients 를 못 읽는다(어드민 폼 저장의 UPDATE 는 되지만
-- RETURNING * 는 거부된다 — 저장 뒤 .select() 로 행을 돌려받지 않는다).
--
-- # 주의 — 이제 products 의 SELECT 는 화이트리스트다
-- 칸을 새로 추가하면 anon·authenticated 는 그 칸을 **자동으로 못 읽는다**. 고객 화면이 읽어야 하는
-- 칸이면 그 마이그레이션에서 `grant select (새칸) on public.products to anon, authenticated` 를 명시한다.
-- 공개 조회에서 select('*') 는 permission denied 로 깨진다 — 칸 목록을 쓴다(lib/audit-rules.test.ts 규칙164).

revoke select on public.products from anon, authenticated;

grant select (
  id, name, slug, description, short_description, price, sale_price, image_url, category, tags,
  stock, is_subscribable, is_active, sort_order, created_at, updated_at, gallery_urls,
  meta_description, sales_count, origin, manufacturer, manufacturer_address,
  manufacture_date_policy, shelf_life_days, net_weight_g, nutrition_facts, allergens,
  storage_method, feeding_guide, pet_food_class, certifications, country_of_packaging, sku,
  sales_channel
) on public.products to anon, authenticated;

-- 자기 검증 — 위 칸 목록이 실제 칸과 어긋나면(빠진 칸·새로 생긴 칸) 마이그레이션 전체가 롤백된다.
do $$
declare
  r record;
begin
  if has_column_privilege('anon', 'public.products', 'ingredients', 'select')
     or has_column_privilege('authenticated', 'public.products', 'ingredients', 'select') then
    raise exception 'products.ingredients 가 아직 공개 조회된다';
  end if;
  for r in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name <> 'ingredients'
  loop
    if not has_column_privilege('anon', 'public.products', r.column_name, 'select')
       or not has_column_privilege('authenticated', 'public.products', r.column_name, 'select') then
      raise exception 'products.% 칸이 공개 조회에서 빠졌다', r.column_name;
    end if;
  end loop;
  if not has_table_privilege('service_role', 'public.products', 'select') then
    raise exception 'service_role 이 products 를 못 읽는다 — 어드민 화면이 깨진다';
  end if;
end $$;
