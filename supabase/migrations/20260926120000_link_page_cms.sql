-- /link(링크인바이오) 콘텐츠를 어드민에서 관리 (사장님 2026-09-26).
--
-- 전엔 lib/links.ts(config-as-code)에 박혀 있어 배너·기간·사진을 바꾸려면 배포가
-- 필요했다. 이제 커버 사진·'파머스테일의 하루' 사진·이벤트/모집 배너(기간 포함)를
-- /admin/link 에서 올린다. 기간이 끝난 배너는 14일간 "기간 종료"로 회색 표시 뒤
-- 자동으로 사라진다(판정은 lib/link-content/status.ts 순수 함수).
--
-- 권한: 공개 마케팅 데이터라 읽기는 누구나(anon/authenticated SELECT 정책),
-- 쓰기는 service_role 만(정책 없음 + 쓰기 grant 회수). 이미지는 기존 event-images
-- 버킷(공개 읽기·관리자 쓰기 정책 보유)의 link/ 접두 경로를 쓴다 — 버킷 신설 없음.

begin;

create table if not exists public.link_banners (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  -- photo = 가로 사진 위 글자 / poster = 세로 포스터(글자는 포스터에 이미 있음, 아래 띠에 제목만)
  variant text not null check (variant in ('photo', 'poster')),
  badge text not null default '',
  notice text not null default '',
  title text not null,
  sub text not null default '',
  href text not null,
  -- 스토리지 public URL 또는 사이트 상대경로('/foo.jpg')
  image_url text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint link_banners_window_order check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

comment on table public.link_banners is '/link 이벤트·모집 배너 — 어드민 편집, 기간 지나면 14일 회색 후 자동 숨김';

create table if not exists public.link_page_settings (
  id smallint primary key default 1 check (id = 1),
  cover_url text not null,
  moment_urls text[] not null default '{}',
  show_store_card boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.link_page_settings is '/link 단일 설정행 — 커버 사진·하루 사진·스토어 카드 표시';

alter table public.link_banners enable row level security;
alter table public.link_page_settings enable row level security;

drop policy if exists "link_banners public read" on public.link_banners;
create policy "link_banners public read" on public.link_banners
  for select using (true);

drop policy if exists "link_page_settings public read" on public.link_page_settings;
create policy "link_page_settings public read" on public.link_page_settings
  for select using (true);

-- 쓰기는 service_role 전용 — 정책을 만들지 않고 grant 도 회수한다.
grant select on table public.link_banners to anon, authenticated;
grant select on table public.link_page_settings to anon, authenticated;
revoke insert, update, delete on table public.link_banners from anon, authenticated;
revoke insert, update, delete on table public.link_page_settings from anon, authenticated;

-- 시드: 지금 코드에 있던 값을 그대로(배포 직후 화면이 비지 않게).
insert into public.link_page_settings (id, cover_url, moment_urls, show_store_card)
values (1, '/pouch-freezer-43.jpg', array['/pouch-freezer-45.jpg', '/bowl-eating.jpg'], true)
on conflict (id) do nothing;

insert into public.link_banners
  (sort_order, enabled, variant, badge, notice, title, sub, href, image_url, starts_on, ends_on)
select
  0, true, 'poster', '모집',
  '서포터즈 1기를 모집하고 있어요',
  '서포터즈 1기 모집',
  '게시물 댓글로 지원해 주세요',
  'https://www.instagram.com/p/DdqZuAnkoVs/',
  '/supporters-poster-2026-09.webp',
  date '2026-09-24', date '2026-09-30'
where not exists (select 1 from public.link_banners);

commit;
