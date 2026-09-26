-- ─────────────────────────────────────────────────────────────────────────────
-- 결제됐지만 아직 안 나간 박스가 있으면 강아지를 지우지 못하게 (2026-09-26 출시 전 점검 8차)
--
-- 예전 게이트는 '진행 중(active·paused) 구독'만 봤다. 그래서 해지 직후(이번 주 박스는 이미 결제·준비 중)
-- 강아지를 지우면 dog_formulas·surveys 가 cascade 로 사라지고 subscriptions.dog_id 는 NULL 이 돼, 피킹
-- 리스트가 결제된 그 박스를 '(강아지 미상)·처방 없음'의 빈 팩으로 보여 줬다. 해지 문구는 "다음 박스부터
-- 멈춰요"라 이미 결제된 박스는 나가야 한다. 탈퇴 라우트의 HAS_OPEN_ORDER 와 같은 기준.
-- 결제됨 = paid·partially_refunded(lib/commerce/paid-status 정본), 아직 안 나감 = pending·preparing.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_block_dog_delete_with_live_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  live_count int;
  open_paid_count int;
begin
  select count(*) into live_count
  from public.subscriptions s
  where s.dog_id = old.id
    and s.status in ('active', 'paused');

  if live_count > 0 then
    raise exception
      '진행 중인 정기배송이 있어 이 아이를 지울 수 없어요. 정기배송을 먼저 정리해 주세요.'
      using errcode = 'FT100';
  end if;

  select count(*) into open_paid_count
  from public.orders o
  join public.subscriptions s on s.id = o.subscription_id
  where s.dog_id = old.id
    and o.payment_status in ('paid', 'partially_refunded')
    and o.order_status in ('pending', 'preparing');

  if open_paid_count > 0 then
    raise exception
      '이미 결제된 박스가 준비 중이라 지금은 이 아이를 지울 수 없어요. 박스가 출발한 뒤에 지워 주세요.'
      using errcode = 'FT101';
  end if;

  return old;
end;
$function$;
