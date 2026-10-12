-- 2026-10-12 기록용 — 운영 DB 는 이미 이 값이다(되풀이해 돌려도 같은 값).
--
-- 사장님 10/12 "GAP·무농약 이거 관련 내용 다 없애": 상품정보 제공고시 '인증·원료' 칸의 '현미 GAP'·'채소 무농약'은
-- 법정 인증 표시라 인증서가 있어야 하는데 증빙이 없다(최종 점검 H10). 4종 레시피에서 두 항목을 뺀다.
-- 흑돼지·한우는 빈 칸이 되어 웹 상품 화면에서 '인증·원료' 줄 자체가 사라진다(ProductDetail 이 빈 값 줄을 거른다).
-- 닭·오리의 '주원료 무항생제'는 사장님이 확인한 것이라 그대로 둔다(규칙179).
-- 같은 날 앞 마이그레이션(20261012000000)이 흑돼지·한우에 두 항목을 넣어 두었으므로 이 파일이 그 뒤에 와야 한다.

update public.products
   set certifications = array_remove(array_remove(certifications, '현미 GAP'), '채소 무농약')
 where slug in ('chicken-basic', 'duck-weight', 'pork-joint', 'beef-premium');
