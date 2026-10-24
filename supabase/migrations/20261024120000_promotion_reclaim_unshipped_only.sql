-- 이벤트 할인은 '안 나간 박스'를 환불할 때만 되살린다 (사장님 2026-10-24 "C로 가자", 규칙322).
--
-- # 무엇이 바뀌나
-- 20260807000200 의 tg_orders_reclaim_promotion 은 이벤트 할인으로 결제된 주문이 전액 환불·취소되면 **언제나**
-- 할인(promotion_claims)을 되살렸다 — 박스를 받은 뒤 환불해도 다음 결제에 또 50%가 붙었다(최대 5만원 두 번).
-- 이제 박스가 나가기 전(shipped_at 이 비어 있음)일 때만 되살린다. 나간 뒤 환불하면 할인은 쓴 것으로 끝난다.
--
-- # 그대로 지키는 것
--  · 청구 도중 해지 → 자동 환불(pending → cancelled): 박스가 안 나갔으니 되살린다(8/7 에 이 트리거를 만든 이유).
--  · 고객 셀프 취소·관리자 전액 취소처럼 발송 전 환불: 되살린다.
--  · 부분 환불(partially_refunded 로 남음): 박스가 나간 주문이라 전처럼 되살리지 않는다.
--
-- # 기준이 같은 것
-- 서포터즈 회차 되돌림(tg_orders_restore_trial_round, 2026-10-15)과 같은 조건 `new.shipped_at is null` —
-- 받은 박스를 환불해도 혜택은 돌아오지 않는다. 이웃 할인(tg_orders_reclaim_neighbor_discount)은 이번에 안 바꿨다.

create or replace function public.tg_orders_reclaim_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ★old 에 'pending' 을 포함한다(2026-08-08) — 청구 도중 해지 자동 환불은 pending → cancelled 다.
  if tg_op = 'UPDATE'
     and old.payment_status in ('pending', 'paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
     -- ★발송 전 박스만(2026-10-24 사장님 결정 C) — 받은 박스를 환불하면 이벤트 할인은 끝난다.
     and new.shipped_at is null
  then
    -- redeemed_at 도 함께 지운다 — 안 지우면 "쓴 시각은 있는데 안 쓴 상태" 라는 모순된 행이 남는다.
    update public.promotion_claims
       set redeemed_order_id = null,
           redeemed_at = null
     where redeemed_order_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_orders_reclaim_promotion() from public, anon, authenticated;

comment on function public.tg_orders_reclaim_promotion() is
  '이벤트 할인으로 결제된 주문이 발송 전에 전액 환불·취소되면 할인(promotion_claims)을 되살린다. 발송 뒤 환불은 되살리지 않는다(2026-10-24 사장님 결정 C).';
