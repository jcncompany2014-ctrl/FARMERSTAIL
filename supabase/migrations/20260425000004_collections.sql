-- Migration: collections (큐레이션 컬렉션)
-- Why: 마켓컬리식 큐레이션 묶음 ("첫 화식 입문 / 노령견 식단 / 다이어트 식단" 등) 지원.
-- Web /collections 라우트가 이 테이블을 읽고 /collections/[slug] 가 collection_items 와 join.
-- 모든 읽기는 public (is_published = true 만), 쓰기는 admin role 만.

-- ── collections ────────────────────────────────────────────────
create table if not exists public.collections (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  subtitle      text,
  curator_note  text,
  -- hero/banner — admin 이 업로드한 이미지 URL
  hero_image_url   text,
  card_image_url   text,
  -- 카드/배너 분기에 쓰는 색 토큰 키. 'ink' | 'terracotta' | 'moss' | 'gold'
  palette       text default 'ink',
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists collections_published_idx
  on public.collections (is_published, sort_order);

-- updated_at trigger
create or replace function public.tg_collections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.tg_collections_set_updated_at();

-- ── collection_items ──────────────────────────────────────────
create table if not exists public.collection_items (
  collection_id  uuid not null references public.collections(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create index if not exists collection_items_position_idx
  on public.collection_items (collection_id, position);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;

-- Public read: only published collections.
drop policy if exists "collections public read" on public.collections;
create policy "collections public read"
  on public.collections
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "collections admin all" on public.collections;
create policy "collections admin all"
  on public.collections
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- collection_items: read only when parent collection is published.
drop policy if exists "collection_items public read" on public.collection_items;
create policy "collection_items public read"
  on public.collection_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.collections c
      where c.id = collection_items.collection_id
        and c.is_published = true
    )
  );

drop policy if exists "collection_items admin all" on public.collection_items;
create policy "collection_items admin all"
  on public.collection_items
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── seed (개발 환경) ─────────────────────────────────────────
-- 운영에서도 이 시드는 무해 — slug 충돌 시 do nothing.
insert into public.collections
  (slug, title, subtitle, curator_note, palette, is_published, sort_order)
values
  ('first-meal',
   '첫 화식 입문',
   '사료에서 화식으로 처음 넘어가는 한 주',
   '갑자기 식단을 바꾸면 장이 놀랄 수 있어요. 7일에 걸쳐 비율을 늘려가는 것이 표준. 이 모음은 "처음 일주일" 분량으로 큐레이션했습니다.',
   'terracotta',
   true,
   1),
  ('senior-care',
   '노령견 식단',
   '소화·관절·면역에 신경 쓴 7세 이상 라인',
   '노령견은 단백질 흡수율이 떨어지고, 관절·면역·소화에 더 많은 신경을 쓰게 됩니다. 수의영양사가 권장하는 영양 비율로 구성된 모음.',
   'moss',
   true,
   2),
  ('diet-care',
   '체중 관리 식단',
   '저칼로리·고단백 + 토퍼로 포만감',
   '단순히 양을 줄이는 다이어트가 아니라, 단백질 비율은 유지하면서 탄수화물·지방을 조정합니다. 토퍼로 포만감을 보완하는 게 핵심.',
   'ink',
   true,
   3),
  ('allergy-friendly',
   '알레르기 케어',
   '단일 단백질 · 곡물 프리',
   '닭/소 단백질 알레르기가 있는 아이들을 위해 단일 단백질·곡물 프리 라인업으로만 묶었어요.',
   'gold',
   true,
   4)
on conflict (slug) do nothing;
