-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260711150401 · 이름 analyses_factor_breakdown. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

alter table public.analyses add column if not exists factor_breakdown jsonb;
