-- 화식 4종 제품 라벨 (사료관리법 표시 + 전자상거래법 §13) 채우기.
--
-- # 근거
--   파머스테일 화식 마스터 레시피 v2.1 (대외비). 영양성분은 레시피 DM(건물)
--   기준값을 as-fed 로 환산: as-fed = DM × 0.30 (레시피 명시 "DM 비율 27~30%"
--   중 칼로리 130~160 정합 지점 = 수분 70% / DM 30%).
--   원재료명·구성비는 레시피 시트12(원가) 정확 비율(합 100%), 함량 많은 순.
--   인증(무항생제/GAP/무농약)은 레시피 원물 sourcing 명세 기준.
--
-- # 영양성분 = 이론치 (설계값)
--   라벨 보장성분 7종(조단백·조지방·수분·조섬유·칼슘·인·조회분)은 출시 전
--   샘플 배치 의뢰검사(7대 성분) 실측으로 정식 확정 예정 — 그때 nutrition_facts
--   숫자만 교체. 레시피 +15% 안전마진 → 이론치 ≈ 실측 예상.
--
-- # nutrition_facts 키
--   ProductFoodInfo(고객 PDP 표시)가 읽는 short 키 스키마. "100g 기준" =
--   as-fed (습식). 38영양소 long 키(crude_*, DM)는 앱 분석용으로 별도.
--
-- # 분류
--   배합사료(애완동물용) — 완전식. 사업자 배합사료 제조업 등록 확인됨.

-- ─────────────── 닭고기 화식 (chicken-basic) ───────────────
UPDATE products SET
  pet_food_class = '배합사료(애완동물용)',
  manufacturer = '파머스테일',
  manufacturer_address = '인천광역시 연수구 송도과학로28번길 28, 송도더샵트리플타워 W동 121호',
  origin = '국내산 (주원료 무항생제)',
  country_of_packaging = '대한민국',
  storage_method = '영하 18℃ 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여하고 재냉동하지 마세요.',
  shelf_life_days = 180,
  manufacture_date_policy = '제품 포장 표기',
  ingredients = '닭가슴살 57%, 현미 6%, 고구마 6%, 당근 5%, 단호박 5%, 시금치 5%, 닭간 5%, 닭염통 5%, 올리브유 2.5%, 비타민·미네랄 프리믹스 2%, 연어유 1%, 강황 0.5%',
  allergens = ARRAY['닭고기','어류(연어유)']::text[],
  certifications = ARRAY['주원료 국내산 무항생제','현미 GAP','채소 무농약']::text[],
  feeding_guide = '체중별 1일 급여량 (성견 유지 기준): 3kg 198g · 5kg 290g · 7kg 373g · 10kg 488g · 15kg 661g. 1일 2회 나눠 급여하고, 활동량·중성화 여부에 따라 ±15% 조절하세요. 냉동 배송되며 해동 후 급여합니다.',
  nutrition_facts = '{"protein_pct":14.9,"fat_pct":5.7,"fiber_pct":0.8,"ash_pct":2.0,"moisture_pct":70,"calcium_pct":0.20,"phosphorus_pct":0.18,"calories_kcal_per_100g":130}'::jsonb
WHERE slug = 'chicken-basic';

-- ─────────────── 오리고기 화식 (duck-weight) ───────────────
UPDATE products SET
  pet_food_class = '배합사료(애완동물용)',
  manufacturer = '파머스테일',
  manufacturer_address = '인천광역시 연수구 송도과학로28번길 28, 송도더샵트리플타워 W동 121호',
  origin = '국내산 (주원료 무항생제)',
  country_of_packaging = '대한민국',
  storage_method = '영하 18℃ 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여하고 재냉동하지 마세요.',
  shelf_life_days = 180,
  manufacture_date_policy = '제품 포장 표기',
  ingredients = '오리안심 53%, 오리간 7%, 현미 6%, 고구마 6%, 당근 5%, 단호박 5%, 시금치 5%, 올리브유 3.5%, 오리염통 3%, 연어유 3%, 비타민·미네랄 프리믹스 2%, 사과 1.5%',
  allergens = ARRAY['오리고기','어류(연어유)']::text[],
  certifications = ARRAY['주원료 무항생제','현미 GAP','채소 무농약']::text[],
  feeding_guide = '체중별 1일 급여량 (성견 유지 기준): 3kg 168g · 5kg 246g · 7kg 317g · 10kg 414g · 15kg 561g. 1일 2회 나눠 급여하고, 활동량·중성화 여부에 따라 ±15% 조절하세요. 냉동 배송되며 해동 후 급여합니다.',
  nutrition_facts = '{"protein_pct":12.2,"fat_pct":8.3,"fiber_pct":0.8,"ash_pct":2.0,"moisture_pct":70,"calcium_pct":0.18,"phosphorus_pct":0.15,"calories_kcal_per_100g":150}'::jsonb
WHERE slug = 'duck-weight';

-- ─────────────── 흑돼지 화식 (pork-joint) ───────────────
UPDATE products SET
  pet_food_class = '배합사료(애완동물용)',
  manufacturer = '파머스테일',
  manufacturer_address = '인천광역시 연수구 송도과학로28번길 28, 송도더샵트리플타워 W동 121호',
  origin = '국내산 (주원료 무항생제)',
  country_of_packaging = '대한민국',
  storage_method = '영하 18℃ 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여하고 재냉동하지 마세요.',
  shelf_life_days = 180,
  manufacture_date_policy = '제품 포장 표기',
  ingredients = '흑돼지안심 56%, 흑돼지간 7%, 현미 6%, 고구마 5%, 단호박 5%, 흑돼지염통 5%, 당근 4%, 시금치 4%, 올리브유 4%, 비타민·미네랄 프리믹스 2%, 연어유 1%, 무 1%',
  allergens = ARRAY['돼지고기','어류(연어유)']::text[],
  certifications = ARRAY['한돈 무항생제','현미 GAP','채소 무농약']::text[],
  feeding_guide = '체중별 1일 급여량 (성견 유지 기준): 3kg 185g · 5kg 272g · 7kg 350g · 10kg 457g · 15kg 619g. 1일 2회 나눠 급여하고, 활동량·중성화 여부에 따라 ±15% 조절하세요. 냉동 배송되며 해동 후 급여합니다.',
  nutrition_facts = '{"protein_pct":13.5,"fat_pct":6.5,"fiber_pct":0.8,"ash_pct":2.0,"moisture_pct":70,"calcium_pct":0.18,"phosphorus_pct":0.17,"calories_kcal_per_100g":140}'::jsonb
WHERE slug = 'pork-joint';

-- ─────────────── 한우 화식 (beef-premium) ───────────────
UPDATE products SET
  pet_food_class = '배합사료(애완동물용)',
  manufacturer = '파머스테일',
  manufacturer_address = '인천광역시 연수구 송도과학로28번길 28, 송도더샵트리플타워 W동 121호',
  origin = '국내산 (한우 무항생제)',
  country_of_packaging = '대한민국',
  storage_method = '영하 18℃ 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여하고 재냉동하지 마세요.',
  shelf_life_days = 180,
  manufacture_date_policy = '제품 포장 표기',
  ingredients = '한우목심 52%, 한우간 8%, 현미 7%, 고구마 7%, 당근 6%, 단호박 6%, 시금치 6%, 한우염통 4%, 비타민·미네랄 프리믹스 2%, 올리브유 1%, 연어유 0.5%, 블루베리 0.5%',
  allergens = ARRAY['소고기','어류(연어유)']::text[],
  certifications = ARRAY['한우 무항생제','현미 GAP','채소 무농약']::text[],
  feeding_guide = '체중별 1일 급여량 (성견 유지 기준): 3kg 159g · 5kg 233g · 7kg 300g · 10kg 392g · 15kg 532g. 1일 2회 나눠 급여하고, 활동량·중성화 여부에 따라 ±15% 조절하세요. 냉동 배송되며 해동 후 급여합니다.',
  nutrition_facts = '{"protein_pct":11.6,"fat_pct":8.6,"fiber_pct":0.8,"ash_pct":2.0,"moisture_pct":70,"calcium_pct":0.18,"phosphorus_pct":0.14,"calories_kcal_per_100g":160}'::jsonb
WHERE slug = 'beef-premium';
