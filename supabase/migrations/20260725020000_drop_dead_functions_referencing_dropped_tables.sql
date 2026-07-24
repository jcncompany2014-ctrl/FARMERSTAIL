-- 2026-07-25 — 폐기 기능의 死 DB 함수 정리 (dead-concept 잔재 스윕).
--
-- 라이브 DB 스캔(pg_proc.prosrc)으로, 이미 드롭된 테이블/개념을 참조하는데
-- 앱·트리거·다른 함수 어디서도 호출되지 않는 死 함수 4개를 발견해 정리한다.
-- 불려도 "relation does not exist" 에러만 날 뿐 데이터 영향은 없지만, 앞의 두
-- 함수는 PostgREST RPC(anon/authenticated)로 노출돼 불필요한 표면적이라 제거.
--
--  · accept_dog_invitation(text)        — 드롭된 dog_invitations SELECT/UPDATE (강아지 초대 기능 제거됨)
--  · lookup_invitation_by_token(text)   — 드롭된 dog_invitations SELECT
--  · upsert_cart_item(uuid,uuid,uuid,integer,integer) — 드롭된 cart_items (낱개 커머스→구독전용 전환)
--  · refund_order_points(uuid,uuid,integer,text,uuid) — 포인트 폐기 잔재. apply_point_delta 는
--    살아있어 크래시는 안 하나, 앱 미호출 + unrefunded 포인트 주문 0건이라 항상 조기반환하는 死 코드.
--
-- 사전 검증(2026-07-25): app grep 0 호출 · pg_trigger 참조 0 · 타 함수 prosrc 참조 0.

DROP FUNCTION IF EXISTS public.accept_dog_invitation(text);
DROP FUNCTION IF EXISTS public.lookup_invitation_by_token(text);
DROP FUNCTION IF EXISTS public.upsert_cart_item(uuid, uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.refund_order_points(uuid, uuid, integer, text, uuid);
