-- Migration: user tier system (회원 등급)
-- Why: 누적 결제 금액에 따라 BRONZE / SILVER / GOLD / VIP 자동 산정. 적립율 +
-- 무료 배송 임계값 + VIP 전용 혜택을 등급으로 구동.
--
-- 등급표 (KRW 누적 paid)
-- ──────────────────────
--   bronze  : 0 +
--   silver  : 100,000 +
--   gold    : 500,000 +
--   vip     : 2,000,000 +
--
-- 결정: cumulative_spend 는 paid → cancelled/refunded 시 차감. orders.payment_status
-- 트리거가 sales_count 와 동일한 패턴으로 갱신.

-- 1) profiles 컬럼 추가
alter table public.profiles
  add column if not exists cumulative_spend bigint not null default 0,
  add column if not exists tier text not null default 'bronze'
    check (tier in ('bronze', 'silver', 'gold', 'vip')),
  add column if not exists tier_updated_at timestamptz;

create index if not exists profiles_tier_idx on public.profiles (tier);

-- 2) 등급 산정 헬퍼 함수
create or replace function public.fn_compute_tier(spend bigint)
returns text
language sql
immutable
as $$
  select case
    when spend >= 2000000 then 'vip'
    when spend >= 500000  then 'gold'
    when spend >= 100000  then 'silver'
    else 'bronze'
  end
$$;

-- 3) profiles.cumulative_spend 변경 시 tier 자동 동기화 트리거
create or replace function public.tg_profiles_sync_tier()
returns trigger
language plpgsql
as $$
declare
  new_tier text;
begin
  new_tier := public.fn_compute_tier(new.cumulative_spend);
  if new_tier <> coalesce(old.tier, '') then
    new.tier := new_tier;
    new.tier_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_tier on public.profiles;
create trigger profiles_sync_tier
  before update of cumulative_spend on public.profiles
  for each row
  when (new.cumulative_spend is distinct from old.cumulative_spend)
  execute function public.tg_profiles_sync_tier();

-- 4) orders.payment_status 트리거 — paid 로 전환 시 cumulative_spend 증가,
--    cancelled/refunded 로 전환 시 차감. sales_count 트리거와 동일한 로직.
create or replace function public.tg_orders_apply_tier_spend()
returns trigger
language plpgsql
security definer
as $$
declare
  amount bigint;
  uid uuid;
begin
  uid := coalesce(new.user_id, old.user_id);
  if uid is null then return new; end if;

  -- INSERT 시 status 가 처음부터 paid 인 케이스, UPDATE 시 paid 로 전환.
  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    amount := coalesce(new.total_amount, 0);
    update public.profiles
       set cumulative_spend = cumulative_spend + amount
     where id = uid;
  end if;

  -- paid → cancelled/refunded 전환 시 차감 (음수 방지).
  if (tg_op = 'UPDATE'
      and old.payment_status = 'paid'
      and new.payment_status in ('cancelled', 'refunded'))
  then
    amount := coalesce(new.total_amount, 0);
    update public.profiles
       set cumulative_spend = greatest(0, cumulative_spend - amount)
     where id = uid;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_apply_tier_spend on public.orders;
create trigger orders_apply_tier_spend
  after insert or update of payment_status on public.orders
  for each row execute function public.tg_orders_apply_tier_spend();

-- 5) 기존 paid 주문 backfill — 마이그레이션 적용 즉시 등급 반영.
do $$
begin
  update public.profiles p
     set cumulative_spend = coalesce(s.total, 0)
    from (
      select user_id, sum(total_amount)::bigint as total
      from public.orders
      where payment_status = 'paid' and user_id is not null
      group by user_id
    ) s
   where p.id = s.user_id;
end $$;
