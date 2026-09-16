-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260630071315 · 이름 drop_coupon_system. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

-- 쿠폰 시스템 폐기(2026-06-30, 자동할인으로 전환). 프로덕션 실측(2026-09-16): 이름에
-- coupon 이 들어간 테이블 0개. 로컬에는 생성 파일만 남아 있었다.
drop table if exists public.coupon_expiry_notifications cascade;
drop table if exists public.inactive_coupon_log cascade;
drop table if exists public.manual_coupon_grants cascade;
drop table if exists public.vip_coupon_log cascade;
drop table if exists public.birthday_coupon_log cascade;
drop table if exists public.user_coupons cascade;
drop table if exists public.coupons cascade;
