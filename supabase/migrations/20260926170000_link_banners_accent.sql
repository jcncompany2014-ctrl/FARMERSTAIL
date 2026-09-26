-- 배너 포인트 컬러 (사장님 2026-09-26): 인스타 모집이면 인스타 그라데이션, 스마트스토어면
-- 네이버 초록, 쿠팡·자사몰도 각각 — 카드 상단 라인·배지·화살표·테두리 틴트에 쓴다.
-- auto = 링크 주소로 추정(lib/link-content/accent.ts inferAccent). 어드민에서 덮어쓸 수 있다.
alter table public.link_banners add column if not exists accent text not null default 'auto'
  check (accent in ('auto', 'none', 'instagram', 'naver', 'coupang', 'farmerstail'));
comment on column public.link_banners.accent is '카드 포인트 컬러 — auto=링크 주소로 추정(instagram.com→instagram, naver→naver, coupang→coupang, farmerstail/상대경로→farmerstail)';
