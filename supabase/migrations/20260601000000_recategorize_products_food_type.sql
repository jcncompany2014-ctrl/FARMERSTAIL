-- 마스터피스 P1-C3: products.category 를 음식 종류 기준으로 정리.
--
-- # 문제
-- category 가 음식종류(간식·영양제)와 배송방식(정기배송·구독)이 섞여 일관성이
-- 없었고, 카탈로그 칩(영어 슬러그 meal/treat/set/supp)·ALLOWED_CATEGORIES(한글
-- 부분집합)·DB(한글 5종)가 3중 불일치라 카테고리 필터 4/5 가 통째로 깨져 있었다.
--
-- # Fix
-- 음식 종류 4분류로 통일: 화식 / 간식 / 영양제 / 체험팩.
-- - 정기배송 8(화식 단품·대용량) + 구독 3(화식 정기박스) → '화식'
-- - 간식 / 영양제 / 체험팩 유지
-- - 구독 여부는 is_subscribable 필터로 분리(카테고리 아님)
--
-- # 코드 영향 0 (사전 확인)
-- category 값을 비교하는 코드는 '간식'/'체험팩' 분기뿐(CatalogProductCard·
-- ProductDetailClient·ProductLongDesc 아이콘/설명). '정기배송'/'구독' 직접
-- 참조 코드는 없음. related-products(.eq('category', product.category))는
-- 화식끼리 매칭이라 정상 동작.

UPDATE public.products SET category = '화식' WHERE category IN ('정기배송', '구독');
