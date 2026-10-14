-- 서포터즈 회차 되돌림은 '발송 전' 박스의 환불만 (2026-10-15 어드민 수정 F-a, 규칙261).
--
-- # 왜
-- 운영 정의(pg_get_functiondef, 2026-10-14 SELECT)의 tg_orders_restore_trial_round 는 '결제됨 → 취소·환불' 전이면 회차를
-- +1 했다 — 박스가 이미 나갔는지 보지 않았다. 바로 옆 배송 횟수 되돌림(tg_orders_subscription_delivery_revert)에는
-- 'new.shipped_at is null' 이 있다. 그래서 배송까지 끝난 100원 박스를 후기 보상·불만으로 전액 환불하면 100원 회차가
-- 하나 더 생겼다(박스 원가 3만~11만 원이 한 번 더 100원에 나감, 반값 시작·인상 동의 일정도 2주 밀림).
-- 운영 현황(2026-10-14): 서포터즈 6명 모두 100원 주문 1건씩 배송 완료 — 지금 바로 해당되는 상태.
--
-- # 고침
--  ① 회차를 되돌리는 조건에 'new.shipped_at is null' 을 더한다 — 배송 횟수 되돌림과 같은 조건.
--  ② 도장이 취소된 사람(20261015100000 — cancelled_at)의 발송 전 환불은 남은 회차(0)가 아니라 '취소 때 남겨 둔 회차'
--     (cancelled_*_remaining)에 더한다 — 취소된 도장이 환불 하나로 다시 100원을 내게 되지 않게, 다시 찍을 때 돌려준다.
-- 그 밖의 조건은 운영 정의 그대로(회차를 실제로 쓴 주문만 — trial_round_consumed_at, 한 번만 — trial_round_restored_at).
--
-- 도장 회수(tg_orders_stamp — 배송 끝난 박스를 전액 환불하면 그 주문의 도장도 지운다)는 **바꾸지 않았다** — 사장님 결정.
--
-- ★적용 순서: 20261015100000 다음(이 함수가 subscription_trials.cancelled_at 을 읽는다 — 없으면 환불이 실패한다,
--   아래 자기 검증이 먼저 막는다).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscription_trials' and column_name = 'cancelled_at'
  ) then
    raise exception '20261015100000(subscription_trials.cancelled_at)을 먼저 적용할 것 — 이 함수가 그 칸을 읽는다';
  end if;
end $$;

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
     -- 이 주문이 회차를 실제로 썼을 때만(10차 C#4).
     and old.trial_round_consumed_at is not null
     -- ★발송 전 박스만(2026-10-15) — 배송 횟수 되돌림과 같은 조건. 받은 박스를 환불해도 회차는 돌아오지 않는다.
     and new.shipped_at is null
  then
    if new.discount_reason = 'trial_cheap' then
      update public.subscription_trials
         set cheap_remaining = cheap_remaining + 1
       where user_id = new.user_id
         and cancelled_at is null;
      -- 도장이 취소된 사람 — 다시 찍을 때 돌려줄 회차에 더한다(지금 가격은 정가 그대로).
      update public.subscription_trials
         set cancelled_cheap_remaining = cancelled_cheap_remaining + 1
       where user_id = new.user_id
         and cancelled_at is not null;
    else
      update public.subscription_trials
         set half_remaining = half_remaining + 1
       where user_id = new.user_id
         and cancelled_at is null;
      update public.subscription_trials
         set cancelled_half_remaining = cancelled_half_remaining + 1
       where user_id = new.user_id
         and cancelled_at is not null;
    end if;
    new.trial_round_restored_at := now();
  end if;
  return new;
end;
$$;

-- 자기 검증 — 발송 전 조건·취소 도장 처리가 들어갔고, 보안 정의자·search_path·트리거가 그대로다.
do $$
declare
  v_def text;
  v_secdef boolean;
  v_conf text[];
begin
  select pg_get_functiondef(p.oid), p.prosecdef, p.proconfig
    into v_def, v_secdef, v_conf
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'tg_orders_restore_trial_round';
  if v_def is null then
    raise exception 'tg_orders_restore_trial_round 가 없다';
  end if;
  if v_def not like '%new.shipped_at is null%' then
    raise exception '회차 되돌림에 발송 전 조건(new.shipped_at is null)이 없다';
  end if;
  if v_def not like '%old.trial_round_consumed_at is not null%' or v_def not like '%new.trial_round_restored_at is null%' then
    raise exception '회차 되돌림의 기존 조건(실제로 쓴 주문만·한 번만)이 빠졌다';
  end if;
  if v_def not like '%cancelled_cheap_remaining = cancelled_cheap_remaining + 1%'
     or v_def not like '%cancelled_half_remaining = cancelled_half_remaining + 1%' then
    raise exception '도장이 취소된 사람의 회차 되돌림 처리가 없다';
  end if;
  if not v_secdef then
    raise exception 'tg_orders_restore_trial_round 가 security definer 가 아니다';
  end if;
  if v_conf is null or not ('search_path=public' = any (v_conf)) then
    raise exception 'tg_orders_restore_trial_round 의 search_path 가 public 이 아니다: %', v_conf;
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.orders'::regclass
      and t.tgname = 'trg_orders_restore_trial_round'
      and not t.tgisinternal
      and pg_get_triggerdef(t.oid) like '%BEFORE UPDATE OF payment_status%tg_orders_restore_trial_round%'
  ) then
    raise exception 'trg_orders_restore_trial_round 트리거(BEFORE UPDATE OF payment_status)가 없다';
  end if;
end $$;
