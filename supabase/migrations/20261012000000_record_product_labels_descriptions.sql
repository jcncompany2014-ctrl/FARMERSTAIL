-- 2026-10-12 기록용 — 운영 DB 는 이미 이 값이다(되풀이해 돌려도 같은 값).
--
-- ① 무항생제 표기(2026-10-11, 사장님 "해" — 운영에 직접 고침). 옛 마이그레이션 20260603000003 이 흑돼지·한우에
--    '주원료 무항생제'·'한돈/한우 무항생제'를 넣어 두어, 마이그레이션으로 DB 를 새로 만들면(브랜치·로컬 초기화) 되살아났다.
--    무항생제는 사장님이 확인한 닭가슴살·오리 안심만(규칙179) — 흑돼지·한우는 원산지와 다른 인증만.
-- ② 상품 설명 칸(2026-10-12, 사장님 "16만 고치면") — 고객 화면엔 안 나오지만(관리자·공개 조회) 옛 주장이 남아 있었다:
--    흑돼지 "사골육수·관절염·글루코사민·관절 진단견 적합·200g/팩"(원재료에 없음 · 팩은 100g · 질병 표현),
--    닭 "모든 연령대 적합"(라벨은 성견 유지). 가게 화면과 같은 소개 문장(lib/store/catalog recipeIntro)으로 맞춘다.

update public.products
   set origin = '국내산 (흑돼지)', certifications = array['현미 GAP', '채소 무농약']
 where slug = 'pork-joint';

update public.products
   set origin = '국내산 (한우)', certifications = array['현미 GAP', '채소 무농약']
 where slug = 'beef-premium';

update public.products set description = '무항생제 닭가슴살에 염통과 간까지, 브로콜리와 블루베리를 더했어요.' where slug = 'chicken-basic';
update public.products set description = '무항생제 오리 안심에 염통과 간까지, 애호박과 사과를 더했어요.' where slug = 'duck-weight';
update public.products set description = '흑돼지 뒷다리살에 염통과 간까지, 무와 양배추를 더했어요.' where slug = 'pork-joint';
update public.products set description = '한우 목심에 염통과 간까지, 비트와 블루베리를 더했어요.' where slug = 'beef-premium';
