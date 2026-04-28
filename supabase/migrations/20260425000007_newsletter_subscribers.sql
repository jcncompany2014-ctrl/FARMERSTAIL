-- Migration: newsletter_subscribers (월 1회 발송 대상)
-- Why: /newsletter 폼이 mailto fallback 인데 이제 /api/newsletter POST 가
-- 직접 이 테이블에 insert. 중복 / 탈퇴 / 이중 동의 (double opt-in) 대비.

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  -- profiles.id 와 매칭 가능하면 link, 게스트면 null.
  user_id         uuid references auth.users(id) on delete set null,
  -- double opt-in 상태. 'pending' = 확인 메일 대기, 'confirmed' = 발송 대상.
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'unsubscribed')),
  -- confirm 토큰 — 이메일 링크에 박혀서 클릭 시 status → confirmed.
  confirm_token   text,
  unsubscribe_token text not null default replace(gen_random_uuid()::text, '-', ''),
  -- 마지막 발송 일자 (옵션)
  last_sent_at    timestamptz,
  source          text default 'web',
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);

create index if not exists newsletter_status_idx
  on public.newsletter_subscribers (status);
create index if not exists newsletter_token_idx
  on public.newsletter_subscribers (confirm_token);

-- RLS ────────────────────────────────────────────────────────
alter table public.newsletter_subscribers enable row level security;

-- 누구나 자기 이메일 insert 가능 (anonymous insert 허용).
-- 단 status 는 자동 'pending' 으로 시작.
drop policy if exists "newsletter public insert" on public.newsletter_subscribers;
create policy "newsletter public insert"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- Admin 만 read / update.
drop policy if exists "newsletter admin all" on public.newsletter_subscribers;
create policy "newsletter admin all"
  on public.newsletter_subscribers
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
