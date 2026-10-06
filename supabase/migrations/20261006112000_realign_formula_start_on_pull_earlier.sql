-- 2026-10-06 10차 점검 B#5 — 발송일을 **앞당기면** 그 사이에 걸린 새 처방의 시작일도 같이 앞당긴다.
--
-- 재현: 다음 박스 D → '2주 미루기'로 D+14 → 그 사이 금액 변경 제안을 승인(applied_from = D+14, total_amount 는 즉시
-- 새 금액) → '미룬 박스 되돌리기'로 다시 D. 그러면 D 박스는 **새 금액으로 결제**되는데 피킹 리스트는
-- applied_from > 발송일인 처방을 건너뛰어 **옛 처방으로 포장**됐다(cycle.ts newFormulaAppliedFrom 상한 패치가 막으려던
-- 바로 그 갈림이 되돌리기로 다시 열림). 어드민 '발송일 바꾸기'로 앞당겨도 같다.
--
-- 고침: subscriptions.next_delivery_date 가 앞당겨지면(새 < 옛), 그 강아지의 발송 가능 처방(approved·auto_applied) 중
-- 시작일이 (새 날짜, 옛 날짜] 에 있는 것을 새 날짜로 옮긴다 — 결제 금액(total_amount, 이미 새 처방 기준)과 포장이 같은
-- 처방을 본다. 되돌리기·어드민 변경은 신청 마감 전 날짜만 허용하므로(undoSkipTarget·ShipDateModal·고객 트리거)
-- 그 박스는 아직 조리 전이다. 미루기(뒤로)는 건드리지 않는다. 청구 크론은 앞으로만 옮긴다.
-- 고객은 dog_formulas 를 쓸 수 없어(service_role 전용) SECURITY DEFINER 트리거로 둔다. 트리거 함수라 RPC 로 부를 수 없지만
-- 실행 권한도 회수한다(규칙: SECURITY DEFINER 노출 금지).

create or replace function public.tg_subscriptions_realign_formula_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dog_id is not null
     and new.next_delivery_date is not null
     and old.next_delivery_date is not null
     and new.next_delivery_date < old.next_delivery_date then
    update public.dog_formulas
       set applied_from = new.next_delivery_date
     where dog_id = new.dog_id
       and approval_status in ('approved', 'auto_applied')
       and applied_from is not null
       and applied_from > new.next_delivery_date
       and applied_from <= old.next_delivery_date;
  end if;
  return null;
end;
$$;

revoke execute on function public.tg_subscriptions_realign_formula_start() from public, anon, authenticated;

drop trigger if exists trg_subscriptions_realign_formula_start on public.subscriptions;
create trigger trg_subscriptions_realign_formula_start
  after update of next_delivery_date on public.subscriptions
  for each row execute function public.tg_subscriptions_realign_formula_start();
