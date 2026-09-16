-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260520065848 · 이름 survey_budget_tier_and_subscription_mix_ratio. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

alter table public.surveys add column if not exists budget_tier text;
-- subscription_mix_ratio 는 2026-09-16 프로덕션 surveys 에 없다(이후 subscriptions.fresh_ratio 로
-- 대체된 것으로 보임 — 20260713 subscriptions_fresh_ratio). 컬럼은 재현하지 않는다.
