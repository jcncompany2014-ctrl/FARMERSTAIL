-- 20260424000004_profile_birth_year.sql
--
-- 만 14세 미만 가입 차단 (PIPA §22-2 / 정보통신망법 §31 의 "법정대리인 동의"
-- 요구를 서비스 자체가 피해가기 위해 아예 14세 미만 signup 을 막는다).
--
-- 전략
-- ────
-- 1. profiles.birth_year (smallint, nullable) — 기존 행은 NULL 유지.
-- 2. CHECK 로 1900..2100 범위만 막고, "14세 이상" 비교는 trigger 로. (current_date
--    은 STABLE 이라 CHECK 안에서 직접 못 쓰기 때문.)
-- 3. before insert/update 시 birth_year != null 이면 age >= 14 강제.
--    raise exception 을 쓰므로 RLS 정책 독립적으로 작동.

BEGIN;

alter table public.profiles
  add column if not exists birth_year smallint;

-- 데이터 위생용 범위 가드. 14세 제약은 trigger 가 담당.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_year_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_year_range
      check (birth_year is null or (birth_year >= 1900 and birth_year <= 2100));
  end if;
end $$;

-- 14세 미만 거부 트리거. 기존 null 행의 update 는 건드리지 않도록
-- new.birth_year is null 이면 통과.
create or replace function public.enforce_min_age_14()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.birth_year is not null then
    if (extract(year from current_date)::int - new.birth_year::int) < 14 then
      raise exception 'UNDER_14: 만 14세 미만은 가입할 수 없어요'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_min_age on public.profiles;
create trigger profiles_enforce_min_age
  before insert or update of birth_year on public.profiles
  for each row execute function public.enforce_min_age_14();

COMMIT;
