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
  --
  -- ★old 에 'pending' 을 반드시 포함한다 (2026-08-08 검토에서 잡힘).
  --  이 파일이 **고치겠다고 적은 바로 그 경로**가 안 잡히고 있었다:
  --  청구 도중 해지 → 자동 환불(subscription-charge:899-908)은 주문을
  --  `pending` 으로 만든 뒤(:595) 성공 UPDATE(:919) **앞에서** 곧장
  --  `cancelled` 로 보낸다. 즉 전이는 paid→cancelled 가 아니라
  --  **pending→cancelled** 다. old 를 paid 계열로 한정하면 발화하지 않는다.
  --  (역설적으로 환불이 **실패**했을 때만 paid 로 남아 나중에 잡혔다.)
  --
  --  claim 이 안 걸린 주문이면 아래 update 가 0행이라 넓혀도 무해하다.
  if tg_op = 'UPDATE'
     and old.payment_status in ('pending', 'paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
  then
    -- redeemed_at 도 함께 지운다 — 안 지우면 원장에 "쓴 시각은 있는데 안 쓴
    -- 상태" 라는 모순된 행이 남는다.
    update public.promotion_claims
       set redeemed_order_id = null,
           redeemed_at = null
     where redeemed_order_id = new.id;
  end if;
  return new;
end;
$$;

-- 다른 orders 트리거들과 같이 `of payment_status` 로 좁힌다 — 송장 갱신 같은
-- 무관한 UPDATE 마다 돌 이유가 없다(20260425000006:63 과 같은 형태).
drop trigger if exists trg_orders_reclaim_promotion on public.orders;
create trigger trg_orders_reclaim_promotion
  after update of payment_status on public.orders
  for each row
  execute function public.tg_orders_reclaim_promotion();

-- 트리거 전용 함수는 RPC 로 노출될 이유가 0 이다 (20260716030000 의 규칙).
-- PostgreSQL 은 트리거 실행 시 EXECUTE 를 검사하지 않으므로 회수해도 발화한다.
revoke execute on function public.tg_orders_reclaim_promotion()
  from public, anon, authenticated;

comment on function public.tg_orders_reclaim_promotion() is
  '환불된 주문에 묶인 프로모션 사용을 되돌린다. 청구 중 해지 자동환불에서 claim 이 소진된 채 남아 재가입 시 정가가 되던 문제(2026-08-07).';
