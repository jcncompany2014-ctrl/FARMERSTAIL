-- R96-F (D7): products 테이블 가격/재고 CHECK 제약 backstop.
--
-- # 문제
-- admin 상품 폼이 브라우저 anon 클라이언트로 products 에 직접 write 하고,
-- client 검증은 price<=0 뿐 (DevTools/직접 호출로 우회 가능). products
-- 테이블엔 CHECK 제약이 0개 (product_variants 만 있음). 그 결과 음수
-- 재고 / sale_price > price (할인가가 정가보다 높음) 가 저장돼 PDP 가격·
-- 할인 표시가 깨질 수 있다 (운영자 오타 실수가 주된 케이스).
--
-- # Fix
-- DB CHECK 가 최소·확실한 backstop. NOT VALID 로 추가해 기존 데이터는
-- 검증 skip (출시 전이라 위반 데이터 거의 없지만, 혹시 있어도 적용 실패
-- 안 함) + 신규 INSERT/UPDATE 만 강제. 적용 후 데이터 정리되면 VALIDATE.
--
-- # 적용 가이드
--   1) 위반 데이터 확인:
--      SELECT id, price, stock, sale_price FROM products
--        WHERE price < 0 OR stock < 0 OR (sale_price IS NOT NULL AND sale_price > price);
--   2) 있으면 UPDATE 로 정리
--   3) 이 migration 적용 (NOT VALID 라 위반 데이터 있어도 성공)
--   4) 정리 완료 후 별도로: ALTER TABLE products VALIDATE CONSTRAINT ...;

ALTER TABLE public.products
  ADD CONSTRAINT products_price_nonneg
    CHECK (price >= 0) NOT VALID;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_nonneg
    CHECK (stock >= 0) NOT VALID;

ALTER TABLE public.products
  ADD CONSTRAINT products_sale_lte_price
    CHECK (sale_price IS NULL OR sale_price <= price) NOT VALID;

COMMENT ON CONSTRAINT products_sale_lte_price ON public.products IS
  'R96-F (D7): 할인가 <= 정가 — admin 오타 backstop';
