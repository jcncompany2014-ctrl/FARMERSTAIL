-- 2026-10-06 10차 점검 C#4 — 환불 때 되돌리는 것은 **그 주문이 실제로 올린 것만**.
--
-- 두 트리거가 "결제됨 → 취소·환불" 전이만 보고 되돌렸다:
--  · tg_orders_restore_trial_round : 서포터즈 체험 회차 +1
--  · tg_orders_subscription_delivery_revert : 구독 total_deliveries −1
-- 그런데 청구 크론에는 결제는 됐지만 회차 차감·배송 횟수 증가 **전에** 빠지는 경로가 있다 — 청구 몇 초 사이 고객이
-- 해지·일시정지하고 즉시 환불이 실패하면 주문은 pending→paid 로만 바뀌고(order_status 는 pending), 환불 큐가 나중에
-- paid→cancelled 로 정산한다. 그때 두 트리거가 돌아 **쓴 적 없는 회차가 하나 더 생기고**(100원 박스 +1) 올린 적 없는
-- 배송 횟수가 줄었다(마이그레이션 20260926180000 주석은 "즉시환불 경로는 pending→refunded 라 안 걸린다"고 했지만
-- 환불 실패 분기를 놓쳤다).
--
-- 고침: 청구 크론이 회차를 **실제로 차감한 주문**에 trial_round_consumed_at, 배송 횟수를 **올린 주문**에
-- delivery_counted_at 을 찍고(주문을 paid/preparing 으로 바꾸는 같은 쓰기), 두 트리거는 그 표시가 있을 때만 되돌린다.
-- 기존 주문은 아래에서 백필한다 — 결제됨·부분환불이면서 order_status 가 pending 이 아닌 정기 주문은 정상 경로로
-- 확정된 것(크론이 paid 와 preparing 을 함께 쓴다). 2026-10-06 09:10 서포터즈 6건(회차 4→3 실측)이 여기 든다.
--
-- 고객은 orders 에 테이블 UPDATE 권한이 없어(컬럼 GRANT 만) 새 칸은 쓸 수 없다 — 아래 끝에서 확인한다.

alter table public.orders
  add column if not exists trial_round_consumed_at timestamptz,
  add column if not exists delivery_counted_at timestamptz;

comment on column public.orders.trial_round_consumed_at is
  '청구 크론이 이 주문으로 서포터즈 체험 회차를 실제로 차감한 시각. 있을 때만 환불 시 회차를 되돌린다(10차 C#4).';
comment on column public.orders.delivery_counted_at is
  '청구 크론이 이 주문으로 구독 total_deliveries 를 올린 시각. 있을 때만 발송 전 환불 시 −1 한다(10차 C#4).';

update public.orders
   set trial_round_consumed_at = coalesce(paid_at, created_at)
 where discount_reason in ('trial_cheap', 'trial_half')
   and payment_status in ('paid', 'partially_refunded')
   and order_status <> 'pending'
   and trial_round_consumed_at is null;

update public.orders
   set delivery_counted_at = coalesce(paid_at, created_at)
 where subscription_id is not null
   and payment_status in ('paid', 'partially_refunded')
   and order_status <> 'pending'
   and delivery_counted_at is null;

create or replace function public.tg_orders_restore_trial_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.discount_reason in ('trial_cheap', 'trial_half')
     and old.payment_status in ('paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
     and new.trial_round_restored_at is null
     -- ★이 주문이 회차를 실제로 썼을 때만(10차 C#4).
     and old.trial_round_consumed_at is not null
  then
    if new.discount_reason = 'trial_cheap' then
      update public.subscription_trials
         set cheap_remaining = cheap_remaining + 1
       where user_id = new.user_id;
    else
      update public.subscription_trials
         set half_remaining = half_remaining + 1
       where user_id = new.user_id;
    end if;
    new.trial_round_restored_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.tg_orders_subscription_delivery_revert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.subscription_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.payment_status in ('paid', 'partially_refunded')
     and new.payment_status is distinct from old.payment_status
     and (
       new.payment_status in ('cancelled', 'refunded')
       or coalesce(new.refunded_amount, 0) >= coalesce(new.total_amount, 0)
     )
     and new.shipped_at is null
     -- ★이 주문이 배송 횟수를 실제로 올렸을 때만(10차 C#4).
     and old.delivery_counted_at is not null
  then
    update public.subscriptions
       set total_deliveries = greatest(0, coalesce(total_deliveries, 0) - 1)
     where id = new.subscription_id;
  end if;
  return new;
end;
$$;

-- 고객이 새 칸을 쓸 수 없는지(권한 없음) — 있으면 마이그레이션 실패.
do $$
begin
  if has_column_privilege('authenticated', 'public.orders', 'trial_round_consumed_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.orders', 'delivery_counted_at', 'UPDATE') then
    raise exception 'orders 표시 칸에 고객 UPDATE 권한이 있다';
  end if;
end;
$$;
