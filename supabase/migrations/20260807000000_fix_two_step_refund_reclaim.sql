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
-- ★SET 절을 다시 적는다. create or replace 는 소유권·권한만 보존하고
--   **그 외 속성은 이 명령에 명시된 값으로 재설정**한다 — 안 적으면
--   20260512000000 이 세운 search_path 잠금이 조용히 풀린다(security definer 함수).
set search_path = public, pg_catalog
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
set search_path = public, pg_catalog
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
    -- ★★ **이미 회수된 만큼은 빼지 않는다.**
    --
    -- 처음 이 마이그레이션을 쓸 때 주석에 "중복 차감이 아니다 — 부분환불의
    -- 비례 차감은 tg_refunds_apply_partial 이 따로 한다" 고 적었는데,
    -- **그게 바로 이중 차감이 되는 이유였다**(2026-08-08 검토에서 잡힘).
    --
    -- 2단 환불 실측:
    --   1차 부분환불 A1 → tg_refunds_apply_partial(20260527000005:63-68)이
    --                     cumulative_spend -= A1
    --   2차 잔액전액   → refunds 행이 is_partial=false 라 그쪽은 조기 반환.
    --                     여기서 total 을 또 빼면 총 (A1 + total) 이 빠진다.
    --                     더한 건 total 하나뿐이다.
    -- greatest(0,...) 클램프가 단일 주문에선 우연히 가려 주지만, 다른 주문이
    -- 쌓인 계정에선 A1 만큼 그대로 어긋난다.
    --
    -- old.refunded_amount = 이 전이 **직전까지** 이미 회수된 금액.
    amount := greatest(
      0,
      coalesce(new.total_amount, 0) - coalesce(old.refunded_amount, 0)
    );
    if amount > 0 then
      update public.profiles
         set cumulative_spend = greatest(0, cumulative_spend - amount)
       where id = uid;
    end if;
  end if;

  return new;
end;
$$;

-- ── 3) 도장 ───────────────────────────────────────────────────────────
create or replace function public.tg_orders_stamp()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
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
    insert into public.stamps (user_id, order_id, stamped_at, expires_at)
    values (
      new.user_id,
      new.id,
      coalesce(new.paid_at, now()),
      coalesce(new.paid_at, now()) + interval '1 year'
    )
    on conflict (order_id) where order_id is not null do nothing;

    perform public.fn_lock_completed_cards(new.user_id);
  end if;

  -- ★ 회수 조건 — **금액으로 판정한다**(2026-08-08 검토에서 좁힘).
  --
  -- 처음엔 `partially_refunded` 로 가는 전이도 무조건 회수 대상에 넣었다.
  -- 그러면 153,100원 중 **100원**만 환불해도 도장이 사라진다 — 그 주문은
  -- 다시 paid 로 전이되지 않으므로 **영구 소멸이고 복구 경로가 없다.**
  -- (품절 1종 부분환불은 박스가 정상적으로 나간 주문이다.)
  --
  -- 도장은 "이 결제가 유효한가" 의 표시다. 그래서 라벨(payment_status)이
  -- 아니라 **실제로 돈이 다 돌아갔는지**로 본다:
  --   · cancelled / refunded 로 가는 전이 (전액 무효)
  --   · 또는 환불 누계가 결제액 이상 (라벨과 무관하게 사실상 전액 환불)
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status is distinct from old.payment_status
      and (
        new.payment_status in ('cancelled', 'refunded')
        or coalesce(new.refunded_amount, 0) >= coalesce(new.total_amount, 0)
      ))
  then
    delete from public.stamps where order_id = new.id;
    perform public.fn_refresh_stamp_count(new.user_id);
  end if;

  return new;
end;
$$;
