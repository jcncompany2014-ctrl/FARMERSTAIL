-- 스탬프 도장판 + 등급 기준 교체 (사장님 확정 2026-07-16) — 프로덕션 적용 완료
-- DB 실제 버전: 20260716030642 · 030738 · 030813 · 031043 (버그수정 2건 포함)
--
-- 구독 결제 1회 = 도장 1개. 10칸 채우면 특별보상(내용 미정). 적립 시점부터 2년 유효.
-- 그리고 **등급의 기준을 누적금액 → 스탬프 개수로 교체**한다.
--
-- # 왜 금액이 아니라 횟수인가
-- 우리 박스는 강아지 덩치에 비례해 값이 다르다. 금액 기준이면 같은 기간 함께해도
-- **대형견 보호자가 자동으로 높은 등급**을 먹는다. 등급 이름이 씨앗→새싹→꽃→열매→나무
-- 라는 '함께한 시간' 서사인데 기준만 돈이었던 셈.
--
-- # ★ 도장은 소진하지 않는다
-- 등급이 개수에 걸려 있어 소진하면 10개마다 등급이 씨앗으로 떨어진다. 그래서 누적되고
-- 10칸 판이 이어진다(1장·2장·3장…). 화면엔 현재 판 10칸만 보인다.
--
-- # ⚠️ 2년 만료 → 등급 강등 가능 (의도)
-- 누적금액은 절대 안 줄었다. 배송이 2주 고정이라 활성 구독자는 만료를 겪을 수 없고
-- (2년이면 52개) 오래 쉬다 온 분만 해당된다.

create table if not exists public.stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 주문이 지워져도 도장은 남는다(고객이 이미 본 값이라).
  order_id uuid references public.orders(id) on delete set null,
  stamped_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.stamps is
  '구독 결제 1회 = 도장 1개. 적립 시점부터 2년 유효. 살아 있는 개수가 곧 회원 등급(fn_compute_tier). 소진하지 않는다 — 소진하면 10개마다 등급이 씨앗으로 떨어진다.';

-- 같은 주문으로 두 번 안 찍히게. 크론 재실행·재시도에도 안전.
create unique index if not exists stamps_order_uniq
  on public.stamps (order_id) where order_id is not null;
create index if not exists stamps_user_expires_idx
  on public.stamps (user_id, expires_at desc);

alter table public.stamps enable row level security;
drop policy if exists "stamps_select_own" on public.stamps;
create policy "stamps_select_own" on public.stamps
  for select using (auth.uid() = user_id);
-- insert/update/delete 는 트리거와 service_role 만. 정책 없음 = 차단.

alter table public.profiles
  add column if not exists stamp_count integer not null default 0;
comment on column public.profiles.stamp_count is
  '살아 있는(미만료) 스탬프 개수 캐시. stamps 트리거가 갱신. 등급의 기준.';

-- ── 등급 사다리 — 누적금액(원) → 스탬프 개수.
--    lib/tiers.ts 의 TIERS[].threshold 와 **같은 사다리여야 한다**.
--    (파라미터명이 spend → stamp_count 로 바뀌어 DROP 후 재생성.)
drop function if exists public.fn_compute_tier(bigint);
create function public.fn_compute_tier(stamp_count bigint)
returns text language sql immutable
set search_path to 'public', 'pg_catalog'
as $function$
  SELECT CASE
    WHEN stamp_count >= 30 THEN 'mate'    -- 나무 · 판 3장 (~14개월)
    WHEN stamp_count >= 20 THEN 'fruit'   -- 열매 · 2장 (~9개월)
    WHEN stamp_count >= 10 THEN 'bloom'   -- 꽃   · 1장 (~4.6개월)
    WHEN stamp_count >= 1  THEN 'sprout'  -- 새싹 · 첫 박스
    ELSE 'seed'                           -- 씨앗 · 첫 한 끼 전
  END
$function$;

create or replace function public.tg_profiles_sync_tier()
returns trigger language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare new_tier text;
begin
  new_tier := public.fn_compute_tier(new.stamp_count);
  if new_tier <> coalesce(old.tier, '') then
    new.tier := new_tier;
    new.tier_updated_at := now();
  end if;
  return new;
end;
$function$;

-- ⚠️ 버그수정(20260716031043): 이 트리거가 `BEFORE UPDATE **OF cumulative_spend**` 로
-- 걸려 있었다. 함수의 입력만 stamp_count 로 바꾸고 **발동 컬럼을 안 바꿔서** 등급이
-- 한 박자 밀렸다(결제후 도장1·seed / 환불후 도장0·sprout). 발동 컬럼도 교체.
drop trigger if exists profiles_sync_tier on public.profiles;
create trigger profiles_sync_tier
  before update of stamp_count on public.profiles
  for each row when (new.stamp_count is distinct from old.stamp_count)
  execute function public.tg_profiles_sync_tier();

create or replace function public.fn_refresh_stamp_count(uid uuid)
returns void language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare n integer;
begin
  select count(*)::int into n
    from public.stamps where user_id = uid and expires_at > now();
  update public.profiles set stamp_count = n where id = uid;
end;
$function$;

create or replace function public.tg_stamps_refresh_count()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  perform public.fn_refresh_stamp_count(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_stamps_refresh_count on public.stamps;
create trigger trg_stamps_refresh_count
  after insert or update or delete on public.stamps
  for each row execute function public.tg_stamps_refresh_count();

-- ── 구독 결제 → 도장. 취소·환불 → 회수.
create or replace function public.tg_orders_stamp()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if new.user_id is null or new.subscription_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    insert into public.stamps (user_id, order_id, stamped_at, expires_at)
    values (new.user_id, new.id,
            coalesce(new.paid_at, now()),
            coalesce(new.paid_at, now()) + interval '2 years')
    -- ⚠️ 버그수정(20260716030813): stamps_order_uniq 가 **부분 인덱스**라 술어를 같이
    -- 줘야 추론된다. 없으면 트리거가 터지고 **구독 결제 트랜잭션 전체가 롤백**된다 —
    -- 도장 하나 때문에 결제가 실패했을 것이다.
    on conflict (order_id) where order_id is not null do nothing;
  end if;

  if (tg_op = 'UPDATE'
      and old.payment_status = 'paid'
      and new.payment_status in ('cancelled', 'refunded'))
  then
    delete from public.stamps where order_id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_orders_stamp on public.orders;
create trigger trg_orders_stamp
  after insert or update on public.orders
  for each row execute function public.tg_orders_stamp();

-- ── 과거 구독 결제 소급 적립 + 전 회원 캐시 재계산 (도장판 도입 전 결제도 인정)
insert into public.stamps (user_id, order_id, stamped_at, expires_at)
select o.user_id, o.id,
       coalesce(o.paid_at, o.created_at),
       coalesce(o.paid_at, o.created_at) + interval '2 years'
  from public.orders o
 where o.subscription_id is not null
   and o.payment_status = 'paid'
   and o.user_id is not null
on conflict (order_id) where order_id is not null do nothing;

select public.fn_refresh_stamp_count(id) from public.profiles;
