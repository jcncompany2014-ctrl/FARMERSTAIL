-- Migration: profiles.birth_month + birth_day (생일 쿠폰 자동 발급용)
-- Why: 기존 birth_year 만으론 "오늘 생일인 사용자" 식별 불가. month + day 추가.
-- 두 컬럼은 nullable — 기존 사용자 영향 없음. 이용 약관 + signup 폼은 별도로
-- 보강해서 신규 가입 시 입력 받도록 (admin 또는 mypage 에서 추후 채울 수 있음).

alter table public.profiles
  add column if not exists birth_month smallint,
  add column if not exists birth_day smallint;

-- 데이터 위생 가드 — 1..12 / 1..31. 윤년/실제 month-day 조합 검증은 application
-- 레이어에서 (예: 2/30 입력은 application 폼이 막는다).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_month_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_month_range
      check (birth_month is null or (birth_month >= 1 and birth_month <= 12));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_day_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_day_range
      check (birth_day is null or (birth_day >= 1 and birth_day <= 31));
  end if;
end $$;

-- birthday_today 인덱스 — cron 이 매일 1회 (month, day) 매칭 sequential scan
-- 을 피하려고 partial index. NULL 은 제외해 인덱스 크기 최소화.
create index if not exists profiles_birthday_idx
  on public.profiles (birth_month, birth_day)
  where birth_month is not null and birth_day is not null;

-- 발급 로그 — 같은 해에 2번 발급되는 거 방지. (year, user_id) unique.
create table if not exists public.birthday_coupon_log (
  user_id     uuid not null references auth.users(id) on delete cascade,
  year        smallint not null,
  coupon_code text not null,
  issued_at   timestamptz not null default now(),
  primary key (user_id, year)
);

alter table public.birthday_coupon_log enable row level security;

-- 본인 row 만 SELECT 가능 — admin 전체 조회는 role check 없음. cron 은
-- service_role 로 동작하므로 RLS bypass.
drop policy if exists "birthday_log self select" on public.birthday_coupon_log;
create policy "birthday_log self select"
  on public.birthday_coupon_log
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "birthday_log admin all" on public.birthday_coupon_log;
create policy "birthday_log admin all"
  on public.birthday_coupon_log
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
