-- 2026-08-20 Pro 업그레이드 후 어드바이저 — 20260819000000 에서 만든 트리거
-- 함수 set_subscription_cancelled_at 이 search_path 미설정(function_search_path
-- _mutable WARN). 고정한다. 트리거 함수라 SECURITY INVOKER 기본이지만 권장 수칙.
-- (프로덕션 apply_migration 반영 완료 — 이 파일은 fresh rebuild 정합용 미러.)
create or replace function public.set_subscription_cancelled_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;
