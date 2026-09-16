-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260711135856 · 이름 create_kibble_tables_m9b. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

create table if not exists public.kibble_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product_name text not null,
  package_size text,
  kcal_per_100g numeric,
  crude_protein numeric,
  crude_fat numeric,
  crude_fiber numeric,
  moisture numeric,
  ash numeric,
  kcal_source text check (kcal_source in ('label', 'atwater', 'feeding_trial')),
  search_keywords text,
  created_at timestamptz not null default now()
);
alter table public.kibble_products enable row level security;
drop policy if exists kibble_products_public_read on public.kibble_products;
create policy kibble_products_public_read on public.kibble_products for select using (true);

create table if not exists public.kibble_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  raw_input text not null,
  request_count integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'added')),
  created_at timestamptz not null default now()
);
alter table public.kibble_requests enable row level security;
drop policy if exists kibble_requests_insert_own on public.kibble_requests;
create policy kibble_requests_insert_own on public.kibble_requests for insert
  with check (user_id = (select auth.uid()));
