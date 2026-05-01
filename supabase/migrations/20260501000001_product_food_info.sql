-- 식품 등 표시·광고에 관한 법률 + 사료관리법 표시기준 14개 의무항목.
--
-- # 배경
-- 전자상거래법 §13 제2항 + 공정위 "전자상거래 등에서의 상품 등의 정보제공에
-- 관한 고시" 별표 1 (식품류) 가 공시 의무 14개 항목을 정한다. 사료관리법
-- 시행규칙 별표 1 도 비슷한 표기 의무. 우리는 둘 다 충족하도록 컬럼 통합 설계.
--
-- # 컬럼 목적
-- - origin: 원산지 (예: "국내산", "미국산 비프 + 국내산 채소")
-- - manufacturer: 제조원 / 수입원 (브랜드 ≠ 제조 OEM 분리)
-- - manufacturer_address: 제조원 소재지
-- - manufacture_date_policy: 제조연월일 표기 정책 (예: "주문 후 7일 내 제조")
-- - shelf_life_days: 소비기한 (제조일 기준 N일). 마이페이지/PDP 자동 표시.
-- - net_weight_g: 1팩 정량 (g)
-- - ingredients: 원재료명 (free-form text. 알레르기 강조어 자체 포함)
-- - nutrition_facts: 영양성분 jsonb — { protein_pct, fat_pct, fiber_pct,
--   ash_pct, moisture_pct, calories_kcal_per_100g, calcium_pct, phosphorus_pct }
-- - allergens: 알레르기 유발 성분 텍스트 배열 (닭/소/돼지/계란/유제품/콩/밀 등)
-- - storage_method: 보관 방법 (냉동/냉장/실온)
-- - feeding_guide: 권장 급여량 가이드
-- - pet_food_class: 사료관리법 분류 (예: "반려동물용 자가소비 사료")
-- - certifications: 인증·검사성적서 텍스트 배열 (HACCP, USDA, 사람등급 등)
-- - country_of_packaging: 포장 국가 (수입품 한정)
--
-- 모든 컬럼은 nullable — admin UI 가 점진적으로 채울 수 있게. PDP 는 값이
-- 있는 항목만 렌더 (없는 항목은 미표시).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS manufacturer_address text,
  ADD COLUMN IF NOT EXISTS manufacture_date_policy text,
  ADD COLUMN IF NOT EXISTS shelf_life_days integer,
  ADD COLUMN IF NOT EXISTS net_weight_g integer,
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS nutrition_facts jsonb,
  ADD COLUMN IF NOT EXISTS allergens text[],
  ADD COLUMN IF NOT EXISTS storage_method text,
  ADD COLUMN IF NOT EXISTS feeding_guide text,
  ADD COLUMN IF NOT EXISTS pet_food_class text DEFAULT '반려동물용 자가소비 사료',
  ADD COLUMN IF NOT EXISTS certifications text[],
  ADD COLUMN IF NOT EXISTS country_of_packaging text;

-- 인덱스: 알레르기 필터링 (장래 검색 기능). gin 인덱스 텍스트 배열에 효율적.
CREATE INDEX IF NOT EXISTS products_allergens_gin
  ON public.products USING gin (allergens);

-- 인덱스: 원산지 필터 (장래 "국내산만 보기" 토글).
CREATE INDEX IF NOT EXISTS products_origin_btree
  ON public.products (origin)
  WHERE origin IS NOT NULL;

COMMENT ON COLUMN public.products.nutrition_facts IS
  'Pet Food 영양성분. JSON 키 (현행): protein_pct fat_pct fiber_pct ash_pct moisture_pct calories_kcal_per_100g calcium_pct phosphorus_pct. 추가 시 PDP 컴포넌트도 갱신.';

COMMENT ON COLUMN public.products.pet_food_class IS
  '사료관리법 시행규칙 별표 1 분류. 기본 "반려동물용 자가소비 사료". 처방식이면 "수의사 처방용 사료" 등으로 교체.';
