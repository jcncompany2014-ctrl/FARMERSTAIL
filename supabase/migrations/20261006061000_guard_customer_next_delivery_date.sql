-- 2026-10-06 10차 점검 B·C — 고객이 next_delivery_date 를 쓸 때의 DB 규칙.
--
-- 고객은 이 칸을 직접 UPDATE 할 수 있다(미루기·되돌리기·재개·해지가 브라우저에서 쓴다). 앱 화면은 정본
-- (lib/shipping-schedule undoSkipTarget·resumeShipDate)으로 올바른 날짜만 고르지만, supabase-js 로 직접 쓰면 아무 날짜나
-- 들어갔다. 실제로 열려 있던 것:
--  ① **이미 결제된 회차 날짜로 되돌리기** → 청구 멱등키(sub-charge:{id}:{next_delivery_date})가 같아져 토스가 원결제를
--     재생하고, 크론은 그걸 새 결제로 받아 돈 없이 '결제됨' 주문·도장·체험 회차 차감이 생길 수 있다(의심 — 토스 재생 전제).
--  ② **청구 진행 중(선점 ~ 성공 쓰기, 수 초)의 미루기** → 고객 CAS 는 통과하고 성공 쓰기가 덮어써, "미뤘어요"라고
--     안내받은 박스가 결제·발송된다(어드민 발송일 바꾸기도 같음).
--  ③ 과거·오늘 날짜 → 즉시 청구·요일 어긋남.
--
-- 규칙(새 값이 옛 값과 다를 때만):
--  · 로그인 없는 쓰기(service_role — 청구 크론·billing-issue·탈퇴)는 검사하지 않는다.
--  · 청구 선점 후 5분 안에는 **누구도**(어드민 포함) 날짜를 못 바꾼다(②).
--  · 어드민은 여기까지. 이하 고객만:
--    - 비우기(null)는 해지(status='cancelled')와 함께일 때만.
--    - 날짜는 KST 오늘+2 이상(서포터즈 일요일 되돌리기 → 화요일 = 오늘+2 허용, ③).
--    - 앞당기기(새 < 옛)는 마지막 결제일(KST)+3 보다 뒤로만(①). 정상 되돌리기 목적지는 늘 마지막 결제 박스 발송일+7 이상이라
--      막히지 않는다(일반: 결제 토 → 발송 화 = +3, 되돌리기 ≥ +10 · 서포터즈: 결제=발송, 되돌리기 ≥ +7).
-- 화면은 실패하면 기존 "변경하지 못했어요" 안내를 띄운다.

create or replace function public.guard_customer_next_delivery_date()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if new.next_delivery_date is not distinct from old.next_delivery_date then
    return new;
  end if;
  -- service_role(크론·서버 라우트)은 auth.uid() 가 없다 — 그쪽은 정본 계산으로만 쓴다.
  if auth.uid() is null then
    return new;
  end if;
  -- ② 청구 진행 중에는 누구도 날짜를 못 바꾼다 — 성공 쓰기가 덮어써 미루기·변경이 조용히 사라진다.
  if old.last_charge_lock_at is not null and old.last_charge_lock_at > now() - interval '5 minutes' then
    raise exception 'NEXT_DELIVERY_LOCKED_CHARGE_IN_PROGRESS' using errcode = 'P0001';
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.next_delivery_date is null then
    if new.status = 'cancelled' then
      return new;
    end if;
    raise exception 'NEXT_DELIVERY_NULL_ONLY_ON_CANCEL' using errcode = 'P0001';
  end if;
  -- ③ 과거·오늘·내일 날짜 금지.
  if new.next_delivery_date < v_today + 2 then
    raise exception 'NEXT_DELIVERY_TOO_SOON' using errcode = 'P0001';
  end if;
  -- ① 앞당기기는 마지막 결제 회차보다 뒤로만.
  if old.next_delivery_date is not null
     and new.next_delivery_date < old.next_delivery_date
     and old.last_charged_at is not null
     and new.next_delivery_date <= (old.last_charged_at at time zone 'Asia/Seoul')::date + 3 then
    raise exception 'NEXT_DELIVERY_BEFORE_LAST_CHARGE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_customer_next_delivery_date on public.subscriptions;
create trigger trg_guard_customer_next_delivery_date
  before update of next_delivery_date on public.subscriptions
  for each row execute function public.guard_customer_next_delivery_date();
