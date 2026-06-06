-- 보안 하드닝 — SECURITY DEFINER 가드 함수의 search_path 고정.
--
-- 배경: Supabase security advisor 가 4개 함수를 "function_search_path_mutable"
-- 로 경고. search_path 가 고정 안 돼 있으면, 공격자가 자신의 search_path 에
-- 악성 객체(같은 이름의 함수/테이블)를 심어 SECURITY DEFINER 함수의 동작을
-- 가로챌 수 있는(이론적) 경로가 열린다. 특히 이 4개는 원장·감사·결제·구독
-- 상태의 "변경 차단" 가드라 더 단단해야 한다.
--
-- 조치: search_path 를 pg_catalog,public 로 고정(mutable → fixed). public 을
-- 유지해 기존 unqualified 참조가 깨지지 않게 하면서 주입 경로를 차단.
--
-- ※ 운영 DB 적용은 창업자 검토 후. (자가품질·결제 등 핵심 가드라 신중)
-- 검증: 적용 후 advisor 재실행 시 function_search_path_mutable 0 확인.

BEGIN;

ALTER FUNCTION public.block_point_ledger_mutations()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.block_admin_audit_log_mutations()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.guard_subscription_status_transition()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.block_payment_events_mutations()
  SET search_path = pg_catalog, public;

COMMIT;
