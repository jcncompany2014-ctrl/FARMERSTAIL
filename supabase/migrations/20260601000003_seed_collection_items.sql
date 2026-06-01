-- 마스터피스 P1-C2: collection_items seed — 4개 컬렉션 상품 매핑.
--
-- # 문제
-- collections 4개(첫 화식 입문/노령견 식단/체중 관리/알레르기 케어)에 큐레이터
-- 노트는 실작성됐으나 collection_items=0 이라 /collections/[slug] 가 전부
-- "곧 큐레이션이 채워져요" 빈 상태로 노출됐다. ItemList JSON-LD 도 빈 배열.
--
-- # 매핑 근거 (각 컬렉션 curator_note 의도에 맞춤)
--  · first-meal     : 입문용 — 체험세트 + 무난한 베이직 + 토퍼(사골육수) + 정착 박스
--  · senior-care    : 노령 소화·관절·면역 — 시니어박스 + 조인트 화식 + 관절/면역/소화/간 영양제
--  · diet-care      : 저칼로리·고단백+토퍼 — 체중박스 + 웨이트 화식 + 저칼로리 토퍼 2종
--  · allergy-friendly: 단일단백질·닭/소 제외 — 오리/연어/사슴 + 장 건강 프로바이오틱스
--
-- # 멱등
-- collection_items 전체 DELETE 후 INSERT(재적용 안전). BEGIN/COMMIT.
-- hero_image_url/card_image_url 은 별도(창업자 이미지) — 본 seed 범위 아님.
-- 상품 추천은 admin/collections 에서 운영자가 언제든 조정 가능.

begin;

delete from public.collection_items;

insert into public.collection_items (collection_id, product_id, position) values
  -- 첫 화식 입문 (025fcc97)
  ('025fcc97-8824-4905-8fa1-b0ef930465a6', 'e571226f-d5d5-486a-be85-10a0c7be497b', 1), -- 시그니처 4종 체험 세트
  ('025fcc97-8824-4905-8fa1-b0ef930465a6', '5fb834b3-2e74-4c53-9faa-7279992f5f62', 2), -- 닭고기 베이직 화식
  ('025fcc97-8824-4905-8fa1-b0ef930465a6', '678f6766-5f8a-4512-b657-c38b4181ab86', 3), -- 천연 사골육수 200ml
  ('025fcc97-8824-4905-8fa1-b0ef930465a6', '20b9cb13-97ea-4cf8-b70b-6d54fcb82a85', 4), -- 시그니처 4주 정기 박스
  -- 노령견 식단 (2761bcf9)
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', 'e179d414-1a94-4daa-88af-b54fa0c22889', 1), -- 시니어 케어 박스 (4주)
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', '9a71b75d-6e89-4025-8cbb-435f2d48ea21', 2), -- 돼지고기 조인트 화식
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', '3e4f8583-a278-4cac-95fd-88e016b68a9b', 3), -- 글루코사민 콘드로이틴 츄어블
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', 'c60d69a3-1f74-44b2-904f-9a2ca6895eb2', 4), -- 오메가-3 EPA·DHA 프리미엄
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', 'dc67bee0-c636-4fda-8259-e9158663b0c4', 5), -- 프로바이오틱스 + 프리바이오틱스
  ('2761bcf9-e9f7-40e2-9c41-692dfdc467ca', '53e0c332-fa10-4e33-8b2e-06cd64d81763', 6), -- 실리마린 + SAMe 간 케어
  -- 체중 관리 식단 (fb48848d)
  ('fb48848d-8f45-4c31-97de-30c00ed9eb28', '88ec3ab7-9875-44ed-b1b4-027d803ab55a', 1), -- 체중관리 박스 (4주)
  ('fb48848d-8f45-4c31-97de-30c00ed9eb28', '1bd154f2-627a-49fd-b072-0ebe48f9361a', 2), -- 오리 웨이트 화식
  ('fb48848d-8f45-4c31-97de-30c00ed9eb28', '7e199688-5269-4a57-8f3f-29f50778e425', 3), -- 하베스트 베지 믹스
  ('fb48848d-8f45-4c31-97de-30c00ed9eb28', 'ac1127f0-314a-4633-9c1c-083d6493c345', 4), -- 동결건조 닭가슴살 트릿
  -- 알레르기 케어 (226ba62c) — 닭/소 제외 단일 단백질
  ('226ba62c-b93e-4b0d-9d35-7cb9f393138c', '1bd154f2-627a-49fd-b072-0ebe48f9361a', 1), -- 오리 웨이트 화식
  ('226ba62c-b93e-4b0d-9d35-7cb9f393138c', '687808bc-83e1-49b1-ab87-6739a31ac3a1', 2), -- 연어 스킨 화식
  ('226ba62c-b93e-4b0d-9d35-7cb9f393138c', 'b36e4439-16db-4c08-afbc-4caf5b21a1f3', 3), -- 자연산 노르웨이 연어 화식
  ('226ba62c-b93e-4b0d-9d35-7cb9f393138c', '72801b21-d3e0-43d5-866f-63b9191adfe6', 4), -- 동결건조 사슴고기 트릿
  ('226ba62c-b93e-4b0d-9d35-7cb9f393138c', 'dc67bee0-c636-4fda-8259-e9158663b0c4', 5); -- 프로바이오틱스 + 프리바이오틱스

commit;
