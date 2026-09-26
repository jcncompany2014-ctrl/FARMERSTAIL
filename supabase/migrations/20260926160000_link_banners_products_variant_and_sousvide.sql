-- 사장님 2026-09-26: "이벤트·모집 배너는 두 개여야 하는데 하나만 있다" — 스마트스토어
-- 리뷰 이벤트도 코드 고정 카드가 아니라 어드민 배너(기간·조건·문구·순서·표시)로.
-- variant 'products' = 글자는 위 흰 띠, 실제 파우치 4종 컷(코드 STORE_CARD.images)은
-- 아래 선반 띠 — 이미지 업로드 없음(image_url '').
-- + '파머스테일의 하루' 맨 앞에 수비드 실물 컷(kitchen-sousvide.jpg).
alter table public.link_banners drop constraint if exists link_banners_variant_check;
alter table public.link_banners add constraint link_banners_variant_check check (variant in ('photo', 'poster', 'products'));

insert into public.link_banners
  (sort_order, enabled, variant, badge, condition, notice, title, sub, href, image_url)
select
  1, true, 'products', '이벤트', '제품당 선착순 10개',
  '스마트스토어 오픈 기념 리뷰 이벤트가 진행 중이에요',
  '리뷰 최대 20% 포인트백',
  '네이버 스마트스토어 오픈 기념 · 화식 4종',
  'https://smartstore.naver.com/farmerstail',
  ''
where not exists (select 1 from public.link_banners where variant = 'products');

update public.link_page_settings
set moment_urls = array['/kitchen-sousvide.jpg', '/pouch-freezer-45.jpg', '/bowl-eating.jpg'], updated_at = now()
where id = 1 and not ('/kitchen-sousvide.jpg' = any(moment_urls));
