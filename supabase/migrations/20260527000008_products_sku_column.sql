-- R86-C1 (D7): products.sku 컬럼 추가 + 5종 화식 매핑.
--
-- 알고리즘 (chronic-sku-mapper.ts / allergy-sku-matrix.ts) 이 추천하는
-- SKU 코드 (FT-C01 / FT-D02 / FT-S03 / FT-P04 / FT-B05) 가 products 테이블의
-- slug 와 매핑되도록 컬럼 추가.
--
-- 이전엔 OrderClient.LINE_TO_SLUG 한 곳에만 하드코딩 — 다른 consumer
-- (분석 페이지, 카탈로그 추천 등) 에서 알고리즘 SKU 코드로 product 조회 불가.
-- 이제 `.from('products').select().eq('sku', 'FT-D02')` 로 직접 lookup 가능.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text;

CREATE INDEX IF NOT EXISTS products_sku_idx
  ON public.products (sku)
  WHERE sku IS NOT NULL;

-- 5종 화식 매핑 (chronic-sku-mapper SkuKey 와 동일)
UPDATE public.products SET sku = 'FT-C01' WHERE slug = 'chicken-basic';
UPDATE public.products SET sku = 'FT-D02' WHERE slug = 'duck-weight';
UPDATE public.products SET sku = 'FT-S03' WHERE slug = 'salmon-skin';
UPDATE public.products SET sku = 'FT-P04' WHERE slug = 'pork-joint';
UPDATE public.products SET sku = 'FT-B05' WHERE slug = 'beef-premium';

COMMENT ON COLUMN public.products.sku IS
  'R86-C1 (D7): 알고리즘 SKU 코드 (chronic-sku-mapper / allergy-sku-matrix 의 SkuKey 와 매핑). FT-prefix.';
