-- 환불된 주문에 프로모션이 소진된 채 남던 것 (2026-08-07 재감사)
--
-- # 무슨 일이 있었나
-- subscription-charge 는 청구 성공 직후 `promotion_claims.redeemed_order_id` 를
-- 찍는다. 그런데 그 아래에 **"청구 도중 해지 → 자동 환불"** 분기가 있다.
-- 즉 50% 이벤트로 가입한 고객이 결제 진행 중 해지하면:
--   전액 환불은 되는데 claim 은 **소진 처리된 채 남는다.**
-- `pending_promotion_rate` 는 `redeemed_order_id IS NULL` 만 보므로 나중에
-- 다시 시작해도 **정가**다. 고객은 받기로 한 혜택을 잃는다.
--
-- 2026-07-29 결제 감사에서 한 번 고쳤던 버그가 새 분기로 재발한 것이고,
-- `/api/orders/[id]/cancel`(전액 환불)도 claim 을 되돌리지 않아 같은 결과다.
--
-- # 왜 트리거인가
-- 환불 경로가 넷이다(청구 중 해지 자동환불 · refund-retry 큐 · 고객 취소 ·
-- admin 부분/전액 취소). 코드마다 되돌리기를 붙이면 **하나를 빠뜨린다** —
-- 이 저장소에서 같은 규칙이 여러 곳에 흩어져 갈라진 사례가 여러 번 있었다.
-- orders 의 상태 전이 한 곳에서 처리한다.

create or replace function public.tg_orders_reclaim_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 결제가 무효가 되는 전이에서만. (부분환불은 제외 — 혜택은 이미 적용됐고
  --  주문 자체는 살아 있다.)
  if tg_op = 'UPDATE'
     and old.payment_status in ('paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
  then
    update public.promotion_claims
       set redeemed_order_id = null
     where redeemed_order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_reclaim_promotion on public.orders;
create trigger trg_orders_reclaim_promotion
  after update on public.orders
  for each row
  execute function public.tg_orders_reclaim_promotion();

comment on function public.tg_orders_reclaim_promotion() is
  '환불된 주문에 묶인 프로모션 사용을 되돌린다. 청구 중 해지 자동환불에서 claim 이 소진된 채 남아 재가입 시 정가가 되던 문제(2026-08-07).';
