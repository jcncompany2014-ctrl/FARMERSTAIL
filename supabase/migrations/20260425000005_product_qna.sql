-- Migration: product_qna (PDP 의 상품 문의 + admin 답변)
-- Why: PDP 의 Q&A 섹션이 stub 상태. 사용자가 문의 작성 / admin 이 답변 / 다른
-- 사용자가 공개된 Q&A 를 열람할 수 있는 표준 동선.

create table if not exists public.product_qna (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  question      text not null,
  -- admin reply
  answer        text,
  answered_by   uuid references auth.users(id),
  answered_at   timestamptz,
  -- 비공개 문의 (예: 개인정보 포함) — 작성자 + admin 만 열람.
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists product_qna_product_idx
  on public.product_qna (product_id, created_at desc);
create index if not exists product_qna_user_idx
  on public.product_qna (user_id, created_at desc);

-- updated_at trigger
create or replace function public.tg_product_qna_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_qna_set_updated_at on public.product_qna;
create trigger product_qna_set_updated_at
  before update on public.product_qna
  for each row execute function public.tg_product_qna_set_updated_at();

-- RLS ────────────────────────────────────────────────────────
alter table public.product_qna enable row level security;

-- 누구나 공개 문의 읽기 (비공개는 작성자 본인 / admin 만)
drop policy if exists "qna public read" on public.product_qna;
create policy "qna public read"
  on public.product_qna
  for select
  to anon, authenticated
  using (
    is_private = false
    or auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 인증 사용자는 자기 문의 작성
drop policy if exists "qna user insert" on public.product_qna;
create policy "qna user insert"
  on public.product_qna
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 작성자 본인 — 답변 달리기 전까지 question 만 수정 가능
drop policy if exists "qna user update" on public.product_qna;
create policy "qna user update"
  on public.product_qna
  for update
  to authenticated
  using (auth.uid() = user_id and answer is null)
  with check (auth.uid() = user_id and answer is null);

-- 작성자 본인 — 답변 달리기 전까지 삭제
drop policy if exists "qna user delete" on public.product_qna;
create policy "qna user delete"
  on public.product_qna
  for delete
  to authenticated
  using (auth.uid() = user_id and answer is null);

-- Admin all
drop policy if exists "qna admin all" on public.product_qna;
create policy "qna admin all"
  on public.product_qna
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
