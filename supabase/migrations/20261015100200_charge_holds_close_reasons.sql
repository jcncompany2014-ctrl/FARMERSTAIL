-- 청구 보류를 닫는 이유 더하기 (2026-10-15 어드민 수정 F-a, 규칙262).
--
-- # 왜
-- 보류(subscription_charge_holds)를 닫는 곳이 '청구 성공(charged)' 하나뿐이었다. 그래서 인상 동의 없이 해지·일시정지하거나
-- 발송일을 바꾼(미루기 포함) 구독의 보류가 영원히 열린 채 자동결제 이력 맨 위에 '박스 보내지 마세요'로 남았고, 날짜가 바뀌면
-- 같은 사람이 2건으로 보였다(열린 보류 유일 색인이 발송일 단위).
--
-- # 고침
-- 청구 크론이 매일 끝에 '더는 맞지 않는 열린 보류'를 닫는다(lib/payments/price-rise staleHoldReason — 판정 정본):
--   cancelled = 구독 해지 · paused = 일시정지 · rescheduled = 발송일이 바뀜(새 날짜가 인상 회차면 그날 새 보류가 생긴다)
--   no_longer_held = 동의 기록·도장 정리로 더는 보류 대상이 아님(결제는 다음 청구에서)
-- 기존 값(charged·cancelled·manual)은 그대로 둔다. 닫힌 행은 resolved_at 과 resolved_reason 이 함께 있다.
--
-- # 읽는 곳(규칙4 — 실제 읽는 곳만 적는다)
-- 이 표를 읽는 화면은 자동결제 이력(app/admin/subscriptions/charges) 하나다. 포장 목록·이번 주 할 일·브리핑은 이 표가 아니라
-- 같은 판정 함수(priceRiseGate·loadChargeProjection)로 따로 본다.
--
-- ★적용 순서: 코드 배포 **전에**(새 코드가 새 이유로 닫으면 옛 제약이 거절한다 — 거절돼도 결제는 그대로, 경보함에 '정리 실패'만).

alter table public.subscription_charge_holds drop constraint if exists subscription_charge_holds_resolved_reason_check;
alter table public.subscription_charge_holds add constraint subscription_charge_holds_resolved_reason_check
  check (
    resolved_reason is null
    or resolved_reason in ('charged', 'cancelled', 'manual', 'paused', 'rescheduled', 'no_longer_held')
  );

-- 닫힘 = 시각과 이유가 함께(한쪽만 있으면 화면이 열린 보류로도, 닫힌 보류로도 못 읽는다).
alter table public.subscription_charge_holds drop constraint if exists subscription_charge_holds_resolved_pair_check;
alter table public.subscription_charge_holds add constraint subscription_charge_holds_resolved_pair_check
  check ((resolved_at is null) = (resolved_reason is null));

comment on table public.subscription_charge_holds is
  '청구 크론이 청구하지 않고 보류한 회차. resolved_at null = 아직 보류 중(자동결제 이력 화면이 읽는다 — 포장 목록·할 일은 같은 판정 함수로 따로). 닫는 이유 charged·cancelled·paused·rescheduled·no_longer_held·manual. 고객 쓰기 불가 — 관리자 읽기(is_admin)·크론 쓰기(service_role). 2026-10-14 A1 · 2026-10-15 F-a.';

-- 자기 검증 — 새 이유가 들어갔고 옛 이유가 그대로이며, 고객 권한은 여전히 없다.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.subscription_charge_holds'::regclass
    and conname = 'subscription_charge_holds_resolved_reason_check';
  if v_def is null
     or v_def not like '%charged%' or v_def not like '%cancelled%' or v_def not like '%manual%'
     or v_def not like '%paused%' or v_def not like '%rescheduled%' or v_def not like '%no_longer_held%' then
    raise exception '보류를 닫는 이유 제약이 다르다: %', v_def;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.subscription_charge_holds'::regclass
      and conname = 'subscription_charge_holds_resolved_pair_check'
  ) then
    raise exception '닫힘 시각·이유 짝 제약이 없다';
  end if;
  if has_table_privilege('authenticated', 'public.subscription_charge_holds', 'update')
     or has_table_privilege('authenticated', 'public.subscription_charge_holds', 'insert')
     or has_table_privilege('anon', 'public.subscription_charge_holds', 'select') then
    raise exception 'subscription_charge_holds 에 고객 쓰기·익명 권한이 생겼다';
  end if;
end $$;
