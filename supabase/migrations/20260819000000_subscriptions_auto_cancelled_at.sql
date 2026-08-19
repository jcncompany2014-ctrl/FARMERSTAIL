-- 2026-08-19 5라운드 감사 — subscriptions.cancelled_at 이 셀프해지 경로에서
-- 안 채워져(9건 중 5건 null) 어드민 해지 집계가 updated_at 근사에 의존했다.
-- updated_at 은 배치 UPDATE 마다 갱신되므로, 마이그레이션·백필이 돌 때마다
-- 과거 해지가 '최근 30일 해지'로 재집계돼 존재하지 않는 해지 급증을 보인다.
--
-- 코드 여러 경로(앱 DogSubscriptionClient·웹 SubscriptionsWebClient·어드민·
-- 계정삭제)를 각각 고치는 대신, 트리거로 못 박는다 — status 가 cancelled 로
-- 전이하는 순간 cancelled_at 자동 기록(이미 명시 set 된 값은 안 덮음).
-- 검산(롤백 트랜잭션): active→cancelled UPDATE 시 cancelled_at 채워짐 확인.
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

drop trigger if exists subscriptions_set_cancelled_at on public.subscriptions;
create trigger subscriptions_set_cancelled_at
  before update on public.subscriptions
  for each row
  execute function public.set_subscription_cancelled_at();

-- 과거 null 5건 백필 — updated_at 이 지금으로선 가장 근사한 해지 시점.
update public.subscriptions
set cancelled_at = updated_at
where status = 'cancelled' and cancelled_at is null;
