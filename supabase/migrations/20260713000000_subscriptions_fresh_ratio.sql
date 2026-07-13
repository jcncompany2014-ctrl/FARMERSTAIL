-- 화식 비율 티어 저장 (2026-07-13 갈아엎기 — 사장님).
-- 박스 구독은 배송·결제 무조건 2주마다, 사용자는 화식 비율(30/60/100)만 선택.
-- coverage_weeks(2/4)로는 이 축을 표현 못 해서 별도 컬럼 신설.
--   30 = 곁들임, 60 = 반반, 100 = 완전 화식.
-- null = 레거시 구독(이 컬럼 도입 전) — 표시는 coverage_weeks 로 근사.
alter table public.subscriptions
  add column if not exists fresh_ratio smallint;

comment on column public.subscriptions.fresh_ratio is
  '화식 비율 티어 (30=곁들임, 60=반반, 100=완전 화식). 2026-07-13 갈아엎기 박스 구독. null=레거시(coverage_weeks 로 근사).';
