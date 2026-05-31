-- R96-F (D7): products 테이블 가격/재고 CHECK 제약 backstop.
--
-- # 문제
-- admin 상품 폼이 브라우저 anon 클라이언트로 products 에 직접 write 하고,
-- client 검증은 price<=0 뿐 (DevTools/직접 호출로 우회 가능). products
-- 테이블엔 CHECK 제약이 0개 (product_variants 만 있음). 그 결과 음수
-- 재고 / sale_price > price (할인가가 정가보다 높음) 가 저장돼 PDP 가격·
-- 할인 표시가 깨질 수 있다 (운영자 오타 실수가 주된 케이스).
--
-- # Fix (적용: 2026-05-31)
-- 적용 직전 위반 데이터 0건을 실측 확인 (price<0 / stock<0 / sale>price 모두 0,
-- 상품 22건). 위반이 없으므로 NOT VALID 단계 없이 즉시 VALID 제약으로 추가해
-- 기존 행까지 완전 검증 (convalidated=true). 신규 INSERT/UPDATE 도 강제.
--
-- # 멱등
-- DO 블록 IF NOT EXISTS 가드 — 파일 version 과 DB schema_migrations version 이
-- 어긋나 재적용되더라도(이 repo 의 기존 패턴) 깨지지 않는다.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_price_nonneg') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_nonneg CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonneg') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sale_lte_price') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sale_lte_price
        CHECK (sale_price IS NULL OR sale_price <= price);
  END IF;
END $$;

COMMENT ON CONSTRAINT products_sale_lte_price ON public.products IS
  'R96-F (D7): 할인가 <= 정가 — admin 오타 backstop';
