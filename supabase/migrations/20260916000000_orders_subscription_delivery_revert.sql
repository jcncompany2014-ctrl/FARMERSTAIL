-- 발송 전 전액환불된 구독 청구는 "배송 횟수"에서 뺀다.
--
-- 왜: subscriptions.total_deliveries 는 청구 성공 때 +1 되는데(subscription-charge 크론),
-- 발송 전에 전액환불(품절 등)돼도 되돌리지 않았다. 2026-09-16 실측: 구독 3af1665b 는
-- 9/1 청구가 발송 전 전액환불됐는데 total_deliveries=2 — 받은 박스 0개인데 고객 화면이
-- "2번째 박스까지 받았어요", 강아지 카드가 "2회 받음" 이라고 말했다. 같은 환불로 도장
-- (trg_orders_stamp)·누적구매액(orders_apply_tier_spend)은 트리거가 되돌렸다 — 같은 층에
-- 같은 판정으로 둔다.
--
-- 판정은 tg_orders_stamp 의 회수 조건과 동일: paid/partially_refunded → cancelled/refunded
-- 또는 환불 누계 >= 결제액. 여기에 "아직 발송 전(shipped_at null)" 을 더한다 — 받은 박스는
-- 환불돼도 받은 것이다. 한 번만 빠진다: refunded → cancelled(토스 웹훅 후속 전이)는
-- old 가 paid/partially_refunded 가 아니라 다시 안 잡힌다.
-- 프로덕션 적용: 2026-09-16 MCP apply_migration · 적용 후 트리거 존재·보정 1건 실측.
create or replace function public.tg_orders_subscription_delivery_revert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
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
  then
    update public.subscriptions
       set total_deliveries = greatest(0, coalesce(total_deliveries, 0) - 1)
     where id = new.subscription_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_orders_subscription_delivery_revert() from public, anon, authenticated;

drop trigger if exists trg_orders_subscription_delivery_revert on public.orders;
create trigger trg_orders_subscription_delivery_revert
  after update on public.orders
  for each row execute function public.tg_orders_subscription_delivery_revert();

-- 데이터 보정: 위 실측 구독 1건(9/1 청구 전액환불·발송 전). 2 → 1 (9/15 청구분만).
update public.subscriptions
   set total_deliveries = 1
 where id = '3af1665b-da93-48a1-bf3a-aef4429ff4a8'
   and total_deliveries = 2;
