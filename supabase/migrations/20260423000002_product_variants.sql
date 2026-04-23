-- ============================================================================
-- Migration: Product variants model (Step 14 of roadmap)
-- ============================================================================
--
-- 지금까지 `products`는 상품 1개 = 1SKU 모델이었다. 반려견 식품 카탈로그가
-- 커지면 곧 다음이 필요해진다:
--   - 같은 상품의 **중량 옵션** (500g / 1kg / 3kg)
--   - 같은 상품의 **맛 옵션** (닭 / 연어 / 오리)
--   - 조합 (예: 1kg 닭, 1kg 연어, 3kg 닭 ...) — 각각 별개 재고/가격.
--
-- 이걸 `products.option_values jsonb` 하나로 표현하면 재고/가격을 옵션별로
-- 관리하기 어려워지고, 장바구니/주문에서 어느 옵션이 선택됐는지 스냅샷이
-- 남지 않는다. 그래서 전통적인 **variant 테이블** 구조로 간다.
--
-- 설계 원칙
-- --------
-- 1. **추가적 마이그레이션**. 기존 `products` row는 그대로. variant가 0개인
--    상품은 기존대로 products.price/stock를 쓰고, variant가 1개 이상 있을 때만
--    UI가 selector를 띄운다. 기존 데이터/쿼리 호환.
--
-- 2. **가격/재고 오버라이드 모델**. variant.price는 nullable — null이면 부모
--    products.price를 따라간다. 대부분의 카탈로그에서 중량만 다르고 맛은
--    같은 가격이라는 점을 반영. stock은 **variant 전용** — variant가 존재하는
--    순간부터 products.stock은 "집계 가능한 총량"이라는 가상 개념이 되고,
--    실 재고 결정권은 variant가 갖는다.
--
-- 3. **주문 스냅샷은 변형 삭제에 살아남아야 함**. order_items.variant_id는 FK 없이
--    raw uuid만 — 관리자가 오래 전 단종된 variant를 지워도 주문 이력은 남는다.
--    variant_name도 같은 이유로 스냅샷.
--
-- 4. **cart_items는 variant 단위로 분리**. (user_id, product_id, variant_id) 복합 키.
--    variant_id가 NULL 인 경우(variant 없는 상품)도 허용. Postgres 15+의
--    `NULLS NOT DISTINCT` 로 (u,p,NULL) 도 NOT NULL 쌍과 동일하게 유일성 보장.
--
-- RLS
-- ---
-- products 공개 읽기 정책과 동일한 패턴. variants 관리는 admin 전용.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) product_variants 테이블
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku           text,                                     -- 관리자용. 고유성은 (product_id, sku) 하에서만
  name          text NOT NULL,                            -- 사용자 노출 라벨: "1kg · 닭고기"
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,       -- 구조화: {"weight":"1kg","flavor":"chicken"}
  price         integer,                                  -- NULL = 부모 products.price 사용
  sale_price    integer,                                  -- NULL = 부모 또는 할인 없음
  stock         integer NOT NULL DEFAULT 0,
  position      integer NOT NULL DEFAULT 0,               -- 상품 내 정렬
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_price_nonneg CHECK (price IS NULL OR price >= 0),
  CONSTRAINT product_variants_sale_price_nonneg CHECK (sale_price IS NULL OR sale_price >= 0),
  CONSTRAINT product_variants_stock_nonneg CHECK (stock >= 0)
);

-- (product_id, position) 정렬용 + (product_id, is_active) 필터용.
CREATE INDEX IF NOT EXISTS product_variants_product_position_idx
  ON public.product_variants (product_id, position);

CREATE INDEX IF NOT EXISTS product_variants_product_active_idx
  ON public.product_variants (product_id) WHERE is_active = true;

-- SKU 유일성은 product 범위 내에서만 — 다른 상품이 같은 SKU를 쓰는 건 비정상이지만
-- 같은 product 안에서 중복 SKU는 명시적으로 금지.
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_uniq
  ON public.product_variants (product_id, sku)
  WHERE sku IS NOT NULL;

-- updated_at 자동 갱신 — 기존 공용 트리거 함수 재사용.
CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Public read — variant 자체가 active 이고, 부모 product 도 active 일 때만.
-- 비활성 상품의 variant가 카탈로그에서 보이는 걸 자연스럽게 차단.
CREATE POLICY "product_variants_public_read"
  ON public.product_variants
  FOR SELECT
  TO authenticated, anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.is_active = true
    )
  );

-- Admin 전체 관리 — 기존 is_admin() 헬퍼 기반.
CREATE POLICY "product_variants_admin_all"
  ON public.product_variants
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 2) cart_items.variant_id
-- ---------------------------------------------------------------------------
-- ON DELETE CASCADE — admin이 variant를 지우면 장바구니에서도 자동 제거. 주문은
-- order_items.variant_id가 FK 없는 raw uuid라 영향 없음.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_id uuid
    REFERENCES public.product_variants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS cart_items_variant_idx
  ON public.cart_items (variant_id) WHERE variant_id IS NOT NULL;

-- (user_id, product_id, variant_id) 유일성. NULLS NOT DISTINCT 로 NULL 끼리도
-- 중복 제거 — Postgres 15+에서 지원. Supabase 현재 15/16 대상이라 안전.
-- 기존에 (user_id, product_id) 단독 unique가 있었다면 충돌하므로 먼저 제거.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_id_product_id_key'
      AND conrelid = 'public.cart_items'::regclass
  ) THEN
    ALTER TABLE public.cart_items DROP CONSTRAINT cart_items_user_id_product_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_uniq
  ON public.cart_items (user_id, product_id, variant_id) NULLS NOT DISTINCT;


-- ---------------------------------------------------------------------------
-- 3) order_items.variant_id / variant_name (이력 스냅샷)
-- ---------------------------------------------------------------------------
-- FK 붙이지 않음 — 주문은 variant가 삭제되어도 보존되어야 함.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS variant_name text;

COMMIT;
