-- 청구 보류 기록 (2026-10-14 어드민 강화 A1, 규칙241).
--
-- # 왜
-- 청구 크론(app/api/cron/subscription-charge)이 **가격이 오르는 회차**(100원→반값 첫 회, 반값→정가 첫 회)인데
-- 그 인상의 동의 기록(subscription_price_consents)이 없으면 그 회차를 청구하지 않고 보류한다. 보류는 '내일 다시'가
-- 아니다 — 발송일(next_delivery_date)을 밀지 않고 그 회차 그대로 멈춰 있다가, 동의가 기록되면 다음 크론이 정상 청구한다.
-- 그동안 사장님이 알아야 한다: Sentry error 한 번(처음 보류될 때) + 이 표(운영 브리핑·할 일·포장 목록이 읽는다).
--
-- # 읽는 법 (다른 화면이 쓰는 계약)
--  · 아직 풀리지 않은 보류 = resolved_at is null. 한 구독·한 발송일·한 사유에 그런 행은 하나뿐이다(아래 부분 유일 색인).
--  · first_held_at = 처음 보류된 시각, last_held_at = 크론이 마지막으로 다시 확인한 시각(매일 갱신).
--  · 크론이 그 구독을 청구에 성공하면 resolved_at·resolved_reason='charged' 로 닫는다.
--  · reason 은 지금 'price_rise_consent_missing' 하나 — 다른 보류 사유가 생기면 check 에 더한다.
--
-- # 권한
-- 고객(anon·authenticated)은 쓸 수 없다. 읽기는 관리자(is_admin())만. 쓰기는 청구 크론(service_role).
--
-- ★적용 순서: 20261014200000 다음, 코드 배포 전.

create table if not exists public.subscription_charge_holds (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 보류된 박스의 발송일(화) = 그때의 next_delivery_date.
  ship_date date not null,
  -- 원래 결제했어야 할 날(KST) — lib/shipping-schedule chargeDateFor.
  charge_date date not null,
  reason text not null check (reason in ('price_rise_consent_missing')),
  -- 어느 인상 — to_half = 100원 → 반값, to_full = 정가로.
  rise text check (rise is null or rise in ('to_half', 'to_full')),
  -- 보류 안 했으면 나갔을 금액(실제 청구 예정액)과 정가.
  charge_amount integer check (charge_amount is null or charge_amount >= 0),
  list_amount integer check (list_amount is null or list_amount >= 0),
  first_held_at timestamptz not null default now(),
  last_held_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_reason text check (resolved_reason is null or resolved_reason in ('charged', 'cancelled', 'manual'))
);

comment on table public.subscription_charge_holds is
  '청구 크론이 청구하지 않고 보류한 회차. resolved_at null = 아직 보류 중(운영 브리핑·할 일·포장 목록이 읽는다). 고객 쓰기 불가 — 관리자 읽기(is_admin)·크론 쓰기(service_role). 2026-10-14 A1.';

create unique index if not exists subscription_charge_holds_open_uniq
  on public.subscription_charge_holds (subscription_id, ship_date, reason)
  where resolved_at is null;

create index if not exists subscription_charge_holds_open_idx
  on public.subscription_charge_holds (resolved_at, first_held_at desc);

alter table public.subscription_charge_holds enable row level security;

revoke all on table public.subscription_charge_holds from anon, authenticated;
grant select on table public.subscription_charge_holds to authenticated;
grant all on table public.subscription_charge_holds to service_role;

drop policy if exists subscription_charge_holds_admin_select on public.subscription_charge_holds;
create policy subscription_charge_holds_admin_select on public.subscription_charge_holds
  for select to authenticated
  using (public.is_admin());

-- 자기 검증 — 고객은 못 쓰고 익명은 못 읽으며, RLS 가 켜져 있고 관리자 읽기 정책만 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.subscription_charge_holds', 'insert')
     or has_table_privilege('authenticated', 'public.subscription_charge_holds', 'update')
     or has_table_privilege('authenticated', 'public.subscription_charge_holds', 'delete')
     or has_table_privilege('anon', 'public.subscription_charge_holds', 'select')
     or has_table_privilege('anon', 'public.subscription_charge_holds', 'insert') then
    raise exception 'subscription_charge_holds 에 고객 쓰기·익명 권한이 남아 있다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.subscription_charge_holds'::regclass) then
    raise exception 'subscription_charge_holds RLS 가 꺼져 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscription_charge_holds'
      and policyname = 'subscription_charge_holds_admin_select'
  ) then
    raise exception 'subscription_charge_holds 관리자 읽기 정책이 없다';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscription_charge_holds' and cmd <> 'SELECT'
  ) then
    raise exception 'subscription_charge_holds 에 SELECT 아닌 정책이 있다 — 쓰기는 service_role 만';
  end if;
end $$;
