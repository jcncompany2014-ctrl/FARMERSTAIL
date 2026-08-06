-- 2단 환불에서 회수 트리거 3개가 전부 죽던 것 (2026-08-07 재감사)
--
-- # 무슨 일이 있었나
-- 회수 분기가 셋 다 `old.payment_status = 'paid'` 를 요구한다:
--   · tg_orders_increment_sales_count   (20260425000006) — sales_count 차감
--   · tg_orders_apply_tier_spend        (20260425000011) — cumulative_spend 차감
--   · tg_orders_stamp                   (20260722020000) — 도장 회수
--
-- 그런데 admin 부분환불(app/api/admin/orders/[id]/partial-cancel)은 2단이다:
--   1차 부분환불 → payment_status = 'partially_refunded'
--   2차 잔액전액 → payment_status = 'refunded'
-- 2차 시점의 `old` 는 'paid' 가 아니라 **'partially_refunded'** 라 세 트리거가
-- 전부 발화하지 않는다. 보상해 줄 tg_refunds_apply_partial 도 2차 refunds 행이
-- `is_partial = false` 라 조기 반환한다.
--
-- 결과 — **전액 환불된 주문인데**
--   (a) 도장이 남는다 → 10개 판을 채우면 fn_lock_completed_cards 가
--       expires_at='infinity' 로 **영구 잠금** + ratchet 등급이 영구 고정된다
--       (나무 = 매 주문 10% 영구 할인). 되돌리기가 사실상 불가능하다.
--   (b) cumulative_spend 에 마지막 회차분이 남는다
--   (c) products.sales_count 가 안 줄어든다
-- 한 번에 전액 환불하는 경로(/api/orders/[id]/cancel)는 정상 — **2단에서만** 터진다.
--
-- # 고침 — 회수 조건만 넓힌다(그 외 로직은 원본 그대로)
--   `old.payment_status = 'paid'`
--   → `old.payment_status in ('paid','partially_refunded')`
-- 중복 차감이 아니다: 이 분기는 new 가 cancelled/refunded 인 **전이에서만**
-- 돌고, 부분환불 자체의 비례 차감은 tg_refunds_apply_partial 이 따로 한다.
--
-- 도장은 여기에 더해 **partially_refunded 로 가는 전이도** 회수 대상에 넣는다.
-- 153,100원 중 153,000원을 환불해도 도장이 남던 문제(재감사 #7) — 도장은
-- "결제가 유효한가"의 표시이지 금액 비례가 아니다.

-- ── 1) sales_count ────────────────────────────────────────────────────
create or replace function public.tg_orders_increment_sales_count()
returns trigger
language plpgsql
security definer
as $$
declare
  rec record;
begin
  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = sales_count + rec.q
        where id = rec.product_id;
    end loop;
  end if;

  -- ★ 'partially_refunded' 에서 넘어오는 전이도 잡는다(2단 환불).
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status in ('cancelled', 'refunded'))
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = greatest(0, sales_count - rec.q)
        where id = rec.product_id;
    end loop;
  end if;

  return new;
end;
$$;

-- ── 2) cumulative_spend ──────────────────────────────────────────────
create or replace function public.tg_orders_apply_tier_spend()
returns trigger
language plpgsql
security definer
as $$
declare
  uid uuid;
  amount bigint;
begin
  uid := coalesce(new.user_id, old.user_id);
  if uid is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    amount := coalesce(new.total_amount, 0);
    update public.profiles
      set cumulative_spend = coalesce(cumulative_spend, 0) + amount
      where id = uid;
  end if;

  -- ★ 'partially_refunded' 에서 넘어오는 전이도 잡는다(2단 환불).
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status in ('cancelled', 'refunded'))
  then
    -- 원본과 동일하게 new.total_amount 를 쓴다(부분환불에서 total_amount 는
    -- 바뀌지 않고 refunded_amount 만 오르므로 old/new 가 같다).
    amount := coalesce(new.total_amount, 0);
    update public.profiles
       set cumulative_spend = greatest(0, cumulative_spend - amount)
     where id = uid;
  end if;

  return new;
end;
$$;

-- ── 3) 도장 ───────────────────────────────────────────────────────────
create or replace function public.tg_orders_stamp()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.user_id is null or new.subscription_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    insert into public.stamps (user_id, order_id, earned_at, expires_at)
    values (
      new.user_id,
      new.id,
      coalesce(new.paid_at, now()),
      coalesce(new.paid_at, now()) + interval '1 year'
    )
    on conflict (order_id) where order_id is not null do nothing;

    perform public.fn_lock_completed_cards(new.user_id);
  end if;

  -- ★ 2단 환불 + 부분환불 전이까지 회수 대상(위 주석 참조).
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status in ('cancelled', 'refunded', 'partially_refunded')
      and new.payment_status is distinct from old.payment_status)
  then
    delete from public.stamps where order_id = new.id;
    perform public.fn_refresh_stamp_count(new.user_id);
  end if;

  return new;
end;
$$;
