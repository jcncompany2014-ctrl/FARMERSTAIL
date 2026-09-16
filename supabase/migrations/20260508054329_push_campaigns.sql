-- ★기록용(사후 재현) — 프로덕션에는 MCP apply_migration 으로 이미 적용돼 있다.
--   원격 schema_migrations version 20260508054329 · 이름 push_campaigns. 로컬에 파일이 없어 새 환경을
--   마이그레이션만으로 못 만들던 것(2026-09-16 전수 점검). 본문은 2026-09-16 프로덕션
--   information_schema·pg_constraint·pg_policies 실측으로 재구성했다(원문 SQL 아님).
--   전부 IF NOT EXISTS 라 재실행 무해.

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) >= 1 and char_length(title) <= 80),
  body text not null check (char_length(body) >= 1 and char_length(body) <= 240),
  url text,
  segment text not null check (segment in ('all', 'inactive_30d', 'active_subscribers')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists push_campaigns_recent_idx on public.push_campaigns (created_at desc);
alter table public.push_campaigns enable row level security;
drop policy if exists push_campaigns_admin_select on public.push_campaigns;
create policy push_campaigns_admin_select on public.push_campaigns for select to authenticated
  using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
drop policy if exists push_campaigns_admin_insert on public.push_campaigns;
create policy push_campaigns_admin_insert on public.push_campaigns for insert to authenticated
  with check ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
-- 테이블 grant 는 anon/authenticated 에 없다(0716·0808 잠금 이후 서버(service_role)만 접근).
