-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260725093309 · 이름 profiles_admin_note. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

alter table public.profiles add column if not exists admin_note text;
-- 컬럼 잠금(authenticated UPDATE 불가)은 20260731000100_profiles_lock_columns 가 담당.
