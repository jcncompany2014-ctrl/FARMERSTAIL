-- 서포터즈(체험단) 박스가 전액 환불·취소되면 회차를 되돌린다 (사장님 2026-09-26 "되돌려줘").
--
-- 왜 트리거인가: 환불 경로가 여럿이다(고객 셀프취소·관리자 취소/부분취소·환불 재시도·
-- 웹훅). 코드 각 경로에 넣으면 하나는 빠진다 — 프로모션 복원(tg_orders_reclaim_promotion)과
-- 같은 자리(orders.payment_status 전이)에서 한 번에 잡는다.
--
-- 언제 되돌리나: 결제가 실제로 잡혔던 주문(old paid|partially_refunded)이 전액
-- 환불·취소(new refunded|cancelled)로 갈 때. 청구 크론의 "재확인 → 즉시환불" 경로는
-- pending → refunded 라 여기 안 걸린다 — 그 경로는 회차를 아예 차감하지 않으니(차감은
-- paid 확정 직전) 되돌릴 것도 없다. 부분환불(partially_refunded 로 남음)은 박스가
-- 나간 것이라 되돌리지 않는다(규칙42: 부분환불 = 결제됨).
--
-- 멱등: orders.trial_round_restored_at 마커 — 같은 주문이 상태를 두 번 오가도 1회만.
-- 도장이 이미 취소된 계정(subscription_trials 행 없음)이면 아무것도 안 한다.

alter table public.orders add column if not exists trial_round_restored_at timestamptz;
comment on column public.orders.trial_round_restored_at is '서포터즈 회차 복원 시각(전액 환불·취소 시 1회) — tg_orders_restore_trial_round';

create or replace function public.tg_orders_restore_trial_round()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and new.discount_reason in ('trial_cheap', 'trial_half')
     and old.payment_status in ('paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
     and new.trial_round_restored_at is null
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
    -- BEFORE 트리거라 마커는 같은 행 쓰기에 실어 보낸다(재귀 UPDATE 없음).
    -- 도장이 없는 계정(0행)이어도 마커는 남긴다 — "이미 판단한 주문"이 정본.
    new.trial_round_restored_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_orders_restore_trial_round() from public, anon, authenticated;

drop trigger if exists trg_orders_restore_trial_round on public.orders;
create trigger trg_orders_restore_trial_round
  before update of payment_status on public.orders
  for each row execute function public.tg_orders_restore_trial_round();
