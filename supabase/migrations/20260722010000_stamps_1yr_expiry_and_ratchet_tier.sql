-- 스탬프 유효기간 2년 → 1년 + 등급 강등 폐지(ratchet) (사장님 확정 2026-07-22)
--
-- # 무엇이 바뀌나
-- 1) 유효기간: 적립 시점부터 **1년**(기존 2년). tg_orders_stamp + 기존 행 소급.
-- 2) 등급은 **한번 도달하면 안 내려간다(ratchet)**. 예전엔 stamp_count 가 만료로
--    줄면 등급도 같이 떨어졌다(그땐 의도였음). 사장님 2026-07-22 지시로 폐지:
--    "10개 모아 씨앗 됐는데 1년 지났다고 강등되면 안 된다. 보이는 스탬프만 사라져라."
--    → tg_profiles_sync_tier 를 **상향 전이만** 반영하게 바꾼다. profiles.tier 가
--      곧 '도달한 최고 등급 = floor'. 화면의 현재 판은 살아있는 스탬프로 0칸까지 빈다
--      (등급 판 아래로는 안 내려감 — lib/stamps.ts cardProgressFloored).
-- 3) 만료를 **실제로 반영**한다. 기존엔 stamps insert/delete 때만 stamp_count 를
--    갱신해서, 시간이 지나 만료돼도(테이블 변화 없음) 캐시가 안 줄었다. 매일 도는
--    크론이 fn_expire_stamps() 를 호출해 살아있는 개수로 재계산한다(등급은 ratchet).
--
-- # ⚠️ ratchet 은 환불로 인한 감소에도 적용된다(의식적 선택)
-- stamp_count 가 어떤 이유로 줄어도 등급은 안 내려간다 — 만료든 환불이든. 유일한
-- 등급 혜택은 나무(50개) 매 주문 10% 할인 하나뿐이고, 50개를 결제한 뒤 환불로 등급만
-- 챙기는 시나리오는 비현실적이다. 고객 선의를 우선해 '절대 강등 없음'으로 단순화한다.
--
-- # 적용 시점 데이터: stamps 0건 · profiles.stamp_count>0 0명 (실측 2026-07-22).
--   전부 no-op 이지만 멱등하게 작성해 실결제 시작 후에도 안전.

-- 1) 등급 랭크 — ratchet 비교용. NULL(등급 없음)=0.
create or replace function public.fn_tier_rank(t text)
returns integer language sql immutable
set search_path to 'public', 'pg_catalog'
as $function$
  select case t
    when 'mate'   then 5
    when 'fruit'  then 4
    when 'bloom'  then 3
    when 'sprout' then 2
    when 'seed'   then 1
    else 0
  end
$function$;

-- 2) 동기화 트리거 — **상향 전이만**(ratchet). 하향(만료·환불로 stamp_count 감소)은
--    무시해 등급을 지킨다. profiles.tier = 도달한 최고 등급 = floor.
create or replace function public.tg_profiles_sync_tier()
returns trigger language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  new_tier text;
begin
  new_tier := public.fn_compute_tier(new.stamp_count);
  if public.fn_tier_rank(new_tier) > public.fn_tier_rank(old.tier) then
    new.tier := new_tier;
    new.tier_updated_at := now();
  end if;
  return new;
end;
$function$;

-- 3) 적립 트리거 — 유효기간 1년.
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
    values (
      new.user_id,
      new.id,
      coalesce(new.paid_at, now()),
      coalesce(new.paid_at, now()) + interval '1 year'
    )
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

-- 4) 기존 스탬프 소급: 만료 = 적립 + 1년.
update public.stamps
   set expires_at = stamped_at + interval '1 year'
 where expires_at is distinct from stamped_at + interval '1 year';

-- 5) 만료 반영 크론용 — 살아있는 개수로 stamp_count 재계산(드리프트 난 프로필만).
--    각 UPDATE 가 tg_profiles_sync_tier 를 태우지만 ratchet 이라 등급은 유지된다.
create or replace function public.fn_expire_stamps()
returns integer language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  affected integer;
begin
  with live as (
    select p.id,
           (count(s.id) filter (where s.expires_at > now()))::int as n
    from public.profiles p
    left join public.stamps s on s.user_id = p.id
    group by p.id
  )
  update public.profiles p
     set stamp_count = live.n
    from live
   where live.id = p.id
     and p.stamp_count is distinct from live.n;
  get diagnostics affected = row_count;
  return affected;
end;
$function$;

comment on function public.fn_expire_stamps() is
  '만료 반영 — 살아있는 스탬프 개수로 stamp_count 재계산. 매일 크론(/api/cron/stamps-expire)이 호출. 등급은 ratchet(tg_profiles_sync_tier)라 이 갱신으로 안 내려간다.';

-- 6) 최초 1회 만료 반영(1년 기준).
select public.fn_expire_stamps();

-- 코멘트 갱신
comment on table public.stamps is
  '구독 결제 1회 = 도장 1개. 적립 시점부터 **1년** 유효(2026-07-22, 기존 2년). 살아있는 개수 = 현재 판 진행도. 등급(profiles.tier)은 한번 도달하면 안 내려감(ratchet).';
comment on column public.profiles.stamp_count is
  '살아 있는(미만료) 스탬프 개수 캐시. stamps 트리거 + 매일 fn_expire_stamps() 크론이 갱신. 등급 상향의 트리거이지만 하향(강등)은 안 시킨다.';
