-- 2026-10-06 11차 점검 A — 고객 발송일 트리거(20261006061000) 보강 두 가지.
--
-- ① 늦은 성공 박스로 되돌리기(A#6): 앞당김 금지 기준이 '마지막 결제일 + 3'(토 결제 → 화 발송)이었는데, 토요일 결제가 실패해
--    **월요일에 늦게 성공**한 박스는 다음 주 화요일(결제일 + 8)에 나간다. 그 사이 날짜(결제일 + 4~8)로 되돌리면 같은 박스를
--    다시 청구할 수 있었다(결제된 박스 조회가 실패해 화면이 '미룬 박스 되돌리기'를 잘못 띄운 경우 등). 기준을 + 8 로.
--    정상 되돌리기 목적지는 늘 '결제된 박스 발송일 + 14' ≥ 결제일 + 14 라 막히지 않는다(서포터즈: 결제=발송, 일반: +3, 늦은 성공: +8).
-- ② 청구 잠금이 해지를 막던 것(A#9): 앱·웹 해지는 {status:'cancelled', next_delivery_date:null} 을 함께 써서 청구 중 5분
--    잠금에 걸려 "잠시 후 다시" 오류가 나는데, 같은 순간의 일시정지는 통과해 크론의 재확인 → 자동 환불을 탔다. 같은 의도의
--    두 버튼 결과가 달랐다. 해지(비우기+cancelled)는 잠금 중에도 허용한다 — 크론 재확인이 일시정지와 똑같이 처리한다.
--    (잠금 표시는 청구 크론이 성공·실패 쓰기에서 지운다 — 이 마이그레이션과 같은 커밋.)

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
  -- 해지(날짜 비우기 + cancelled)는 언제나 허용 — 청구 중이면 크론 재확인이 자동 환불한다(일시정지와 같은 결과).
  if new.next_delivery_date is null and new.status = 'cancelled' then
    return new;
  end if;
  -- 청구 진행 중에는 누구도 날짜를 못 바꾼다 — 성공 쓰기가 덮어써 미루기·변경이 조용히 사라진다.
  if old.last_charge_lock_at is not null and old.last_charge_lock_at > now() - interval '5 minutes' then
    raise exception 'NEXT_DELIVERY_LOCKED_CHARGE_IN_PROGRESS' using errcode = 'P0001';
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.next_delivery_date is null then
    raise exception 'NEXT_DELIVERY_NULL_ONLY_ON_CANCEL' using errcode = 'P0001';
  end if;
  -- 과거·오늘·내일 날짜 금지.
  if new.next_delivery_date < v_today + 2 then
    raise exception 'NEXT_DELIVERY_TOO_SOON' using errcode = 'P0001';
  end if;
  -- 앞당기기는 마지막 결제 박스보다 뒤로만(늦은 성공 박스 = 결제일 + 8 까지 포함).
  if old.next_delivery_date is not null
     and new.next_delivery_date < old.next_delivery_date
     and old.last_charged_at is not null
     and new.next_delivery_date <= (old.last_charged_at at time zone 'Asia/Seoul')::date + 8 then
    raise exception 'NEXT_DELIVERY_BEFORE_LAST_CHARGE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
