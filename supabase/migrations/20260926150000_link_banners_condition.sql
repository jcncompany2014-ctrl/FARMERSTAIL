-- /link 배너 배지 옆 작은 조건 문구 (사장님 2026-09-26: "조건이 살짝 나오면").
-- 기간(starts_on~ends_on)은 자동으로 붙고, 이 칸은 "선착순 5두" 같은 추가 조건.
alter table public.link_banners add column if not exists condition text not null default '';
comment on column public.link_banners.condition is '배지 옆 작은 회색 조건 문구 (예: 선착순 5두) — 비우면 표시 안 함';
