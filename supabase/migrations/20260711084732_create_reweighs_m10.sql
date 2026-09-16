-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260711084732 · 이름 create_reweighs_m10. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

create table if not exists public.reweighs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null,
  weight_kg numeric not null,
  baseline_weight_kg numeric not null,
  bcs integer,
  goal text not null check (goal in ('maintain', 'lose', 'gain')),
  weight_delta_pct numeric not null,
  prev_der integer not null,
  new_der integer not null,
  adjust_note text,
  measured_at date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reweighs_dog_created on public.reweighs (dog_id, created_at desc);
alter table public.reweighs enable row level security;
drop policy if exists reweighs_select_own on public.reweighs;
create policy reweighs_select_own on public.reweighs for select
  using (user_id = (select auth.uid()));
