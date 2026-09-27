-- 이웃 할인 — 지인·쓰레드 등에서 온 특정 고객에게 어드민이 첫 박스 할인율을 붙여주는 도장
-- (사장님 2026-09-27, 이름 "이웃 할인"). 이벤트 코드(불특정 다수)와 달리 사람을 지정한다.
--
-- 규칙: 첫 결제 1회만(redeemed_order_id 로 소진), 등급·이벤트 코드와 겹치면 더 큰 쪽 하나만
-- (resolveAutoDiscount 가 판정 — 서포터즈 체험가가 있으면 그것이 우선). 전액 환불·취소되면
-- 프로모션과 같은 자리(orders.payment_status 전이)에서 소진을 되돌린다.
-- 쓰기는 service_role(어드민 API)만 — subscription_trials 와 같은 원칙.

create table if not exists public.neighbor_discounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 할인율 0.10~0.50 (어드민 선택지 10·15·20·30·50%)
  rate numeric(4, 3) not null check (rate >= 0.05 and rate <= 0.5),
  -- 출처 메모: 지인 이름·쓰레드·인스타 DM 등 (나중에 어디서 온 사람이 구독까지 갔는지 본다)
  source text not null default '',
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  redeemed_order_id uuid,
  redeemed_at timestamptz
);

comment on table public.neighbor_discounts is '이웃 할인 — 어드민이 특정 고객에게 붙이는 첫 박스 1회 할인(율). 소진=redeemed_order_id';

alter table public.neighbor_discounts enable row level security;
revoke all on table public.neighbor_discounts from anon, authenticated;

-- 주문 할인 사유에 'neighbor' 추가 (없으면 청구가 CHECK 에 막혀 전멸 — 체험단 때의 사고, 규칙96)
alter table public.orders drop constraint if exists orders_discount_reason_check;
alter table public.orders add constraint orders_discount_reason_check
  check (discount_reason is null or discount_reason = any (array['tier', 'promotion', 'none', 'trial_cheap', 'trial_half', 'neighbor']));

-- 전액 환불·취소되면 소진을 되돌린다 — tg_orders_reclaim_promotion 과 같은 전이 조건.
create or replace function public.tg_orders_reclaim_neighbor_discount()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and new.discount_reason = 'neighbor'
     and old.payment_status in ('pending', 'paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
  then
    update public.neighbor_discounts
       set redeemed_order_id = null,
           redeemed_at = null
     where redeemed_order_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_orders_reclaim_neighbor_discount() from public, anon, authenticated;

drop trigger if exists trg_orders_reclaim_neighbor_discount on public.orders;
create trigger trg_orders_reclaim_neighbor_discount
  after update of payment_status on public.orders
  for each row execute function public.tg_orders_reclaim_neighbor_discount();
