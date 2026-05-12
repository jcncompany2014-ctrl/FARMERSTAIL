-- Supabase advisor 의 function_search_path_mutable 경고 11건 일괄 해소.
--
-- SET search_path 가 비어 있으면 함수가 호출 시 사용자의 search_path 를
-- 그대로 따른다. 만약 누군가 같은 이름의 함수/테이블을 다른 schema 에 만들고
-- 호출 사용자의 search_path 가 그 schema 를 먼저 보면 의도하지 않은 객체가
-- 실행될 수 있다 (특히 SECURITY DEFINER 와 결합되면 권한 escalation 위험).
--
-- 안전한 기본값 = public, pg_catalog. 모든 trigger/normal 함수에 동일 적용.
-- 함수 동작은 변하지 않음 — 단지 lookup 경로를 고정.

ALTER FUNCTION public.enforce_min_age_14() SET search_path = public, pg_catalog;
ALTER FUNCTION public.events_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.fn_compute_tier(spend bigint) SET search_path = public, pg_catalog;
ALTER FUNCTION public.sha256_hex(input text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_collections_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_faqs_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_orders_apply_tier_spend() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_orders_increment_sales_count() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_partners_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_product_qna_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.tg_profiles_sync_tier() SET search_path = public, pg_catalog;
