-- 정기배송 변경 기록 — 누가·무엇을·전→후·언제 (2026-10-14 어드민 고객 화면 C3, 규칙255).
--
-- # 왜
-- 고객이 직접 한 건너뛰기·미루기·일시정지·재개·해지·화식 비율 변경·카드 변경이 DB 에 남지 않았다(GA4·메타 픽셀에만).
-- "이 분 왜 이번 박스가 안 갔지?"를 사장님이 고객 화면에서 바로 볼 수 없었다. 이 표가 고객 화면의 '변경 기록'이다.
--
-- # 누가 기록하나 — 두 갈래
--  1) 로그인한 사람이 subscriptions 를 직접 바꾼 경우(고객 앱·웹의 건너뛰기·일시정지·재개·해지, 어드민 구독 화면의
--     관리자 쿠키 쓰기) → 아래 트리거가 남긴다. 고객 화면 코드는 브라우저에서 바로 UPDATE 하므로 API 를 거치지 않는다 —
--     트리거여야 빠짐없이 잡힌다. auth.uid() = 주인이면 customer, 관리자면 admin.
--  2) 서버(service_role)가 바꾼 경우 — auth.uid() 가 없어 트리거는 **건너뛴다**(audit_admin_row_change 와 같은 규칙:
--     청구 크론이 행마다 UPDATE 하므로 여기서 빠져야 싸다). 대신 그 코드가 누가 시켰는지 알고 직접 남긴다
--     (lib/subscription-events-record: 화식 비율 변경·카드 등록·신청·금액 동의 = customer, 재제안 크론의 알레르기 정지 = cron).
--
-- # 기록 실패가 고객 동작을 막지 않는다
-- 트리거 본문은 예외를 삼키고 경고만 남긴다(begin … exception when others → raise warning). AFTER 트리거라 행 값도
-- 바꾸지 않는다. 표가 없거나 칸이 어긋나도 고객의 건너뛰기·해지는 그대로 저장된다.
--
-- # 권한
-- 고객은 읽기·쓰기 불가. 관리자 읽기(is_admin()), 쓰기는 트리거(SECURITY DEFINER)와 서버(service_role)만.
-- 개인정보 없음 — 날짜·상태·비율·금액·카드 끝 4자리만 남긴다(빌링키 값은 절대 남기지 않는다).
--
-- ★적용 순서: 코드 배포 전에 적용한다(새 고객 화면이 이 표를 읽는다). 적용 전 배포여도 고객 동작은 막히지 않는다 —
--   서버 헬퍼는 실패를 삼키고, 트리거는 이 파일이 만든다.

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  -- 구독 주인(고객). 고객 화면이 이 칸으로 모아 본다.
  user_id uuid not null,
  actor text not null check (actor in ('customer', 'admin', 'cron', 'system')),
  -- 실제로 누른 사람(로그인 사용자). 크론·서버는 null.
  actor_user_id uuid,
  kind text not null check (kind in (
    'create', 'skip', 'skip_undo', 'reschedule', 'pause', 'resume', 'cancel',
    'fresh_ratio', 'amount', 'card', 'status'
  )),
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  -- 어디서 왔나 — 'db_trigger' 또는 'api/subscriptions/fresh-ratio' 같은 코드 위치.
  source text,
  created_at timestamptz not null default now()
);

comment on table public.subscription_events is
  '정기배송 변경 기록(누가·무엇·전→후·시각). 로그인 쓰기는 트리거, 서버 쓰기는 코드가 남긴다. 고객 읽기·쓰기 불가. 2026-10-14 C3.';

create index if not exists subscription_events_user_idx
  on public.subscription_events (user_id, created_at desc);
create index if not exists subscription_events_sub_idx
  on public.subscription_events (subscription_id, created_at desc);

alter table public.subscription_events enable row level security;

revoke all on table public.subscription_events from anon, authenticated;
grant select on table public.subscription_events to authenticated;
grant all on table public.subscription_events to service_role;

drop policy if exists subscription_events_admin_select on public.subscription_events;
create policy subscription_events_admin_select on public.subscription_events
  for select to authenticated
  using (public.is_admin());

-- 로그인 쓰기 기록 트리거.
create or replace function public.log_subscription_login_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_actor text;
  v_kind text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_days integer;
begin
  -- 서버·크론(service_role)은 uid 가 없다 — 그 쓰기는 코드가 직접 남긴다(위 머리말 2).
  if v_uid is null then
    return null;
  end if;

  begin
    if v_uid = new.user_id then
      v_actor := 'customer';
    elsif public.is_admin() then
      v_actor := 'admin';
    else
      -- 주인이 아닌 로그인(가족 공유 등) — 고객 쪽 동작으로 보고, 누가 눌렀는지는 actor_user_id 로 남긴다.
      v_actor := 'customer';
    end if;

    if tg_op = 'INSERT' then
      v_kind := 'create';
      v_after := jsonb_build_object(
        'status', new.status,
        'fresh_ratio', new.fresh_ratio,
        'total_amount', new.total_amount,
        'next_delivery_date', new.next_delivery_date
      );
    else
      if new.status is distinct from old.status then
        v_before := v_before || jsonb_build_object('status', old.status);
        v_after := v_after || jsonb_build_object('status', new.status);
      end if;
      if new.next_delivery_date is distinct from old.next_delivery_date then
        v_before := v_before || jsonb_build_object('next_delivery_date', old.next_delivery_date);
        v_after := v_after || jsonb_build_object('next_delivery_date', new.next_delivery_date);
      end if;
      if new.fresh_ratio is distinct from old.fresh_ratio then
        v_before := v_before || jsonb_build_object('fresh_ratio', old.fresh_ratio);
        v_after := v_after || jsonb_build_object('fresh_ratio', new.fresh_ratio);
      end if;
      if new.total_amount is distinct from old.total_amount then
        v_before := v_before || jsonb_build_object('total_amount', old.total_amount);
        v_after := v_after || jsonb_build_object('total_amount', new.total_amount);
      end if;
      -- 카드 — 빌링키 값은 남기지 않는다. 해지 때 트리거가 키를 지우는 건 해지 기록으로 충분하다.
      if new.billing_key is distinct from old.billing_key and new.status is not distinct from old.status then
        v_before := v_before || jsonb_build_object('card_last4', old.billing_card_last4);
        v_after := v_after || jsonb_build_object('card_last4', new.billing_card_last4);
      end if;

      if v_after = '{}'::jsonb and v_before = '{}'::jsonb then
        return null; -- 알림 설정·메모 같은 다른 칸만 바뀐 쓰기
      end if;

      if new.status is distinct from old.status then
        v_kind := case
          when new.status = 'cancelled' then 'cancel'
          when new.status = 'paused' then 'pause'
          when old.status = 'paused' and new.status = 'active' then 'resume'
          else 'status'
        end;
      elsif new.next_delivery_date is distinct from old.next_delivery_date then
        -- 건너뛰기 = 다음 발송을 한 주기(14일, lib/shipping-schedule nextCycleDate) 미룸 · 되돌리기 = 14일 당김.
        v_days := case
          when old.next_delivery_date is not null and new.next_delivery_date is not null
            then new.next_delivery_date - old.next_delivery_date
        end;
        v_kind := case
          when v_days = 14 then 'skip'
          when v_days = -14 then 'skip_undo'
          else 'reschedule'
        end;
      elsif new.fresh_ratio is distinct from old.fresh_ratio then
        v_kind := 'fresh_ratio';
      elsif new.billing_key is distinct from old.billing_key then
        v_kind := 'card';
      else
        v_kind := 'amount';
      end if;
    end if;

    insert into public.subscription_events
      (subscription_id, user_id, actor, actor_user_id, kind, before, after, source)
    values
      (new.id, new.user_id, v_actor, v_uid, v_kind, v_before, v_after, 'db_trigger');
  exception when others then
    -- 기록 실패가 고객 동작을 막지 않는다 — 경고만 남기고 지나간다.
    raise warning '[subscription-events trigger] % %: %', tg_op, new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.log_subscription_login_change() from public, anon, authenticated;

drop trigger if exists subscription_events_log_login_change on public.subscriptions;
create trigger subscription_events_log_login_change
  after insert or update on public.subscriptions
  for each row execute function public.log_subscription_login_change();

-- 자기 검증 — 고객은 못 쓰고, 관리자 읽기 정책·트리거·예외 삼키기가 있다.
do $$
declare
  v_def text;
begin
  if has_table_privilege('authenticated', 'public.subscription_events', 'insert')
     or has_table_privilege('authenticated', 'public.subscription_events', 'update')
     or has_table_privilege('authenticated', 'public.subscription_events', 'delete')
     or has_table_privilege('anon', 'public.subscription_events', 'select') then
    raise exception 'subscription_events 에 고객 쓰기·익명 읽기 권한이 남아 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscription_events' and policyname = 'subscription_events_admin_select'
  ) then
    raise exception 'subscription_events 관리자 읽기 정책이 없다';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.subscriptions'::regclass
      and t.tgname = 'subscription_events_log_login_change'
      and not t.tgisinternal
  ) then
    raise exception 'subscriptions 에 변경 기록 트리거가 없다';
  end if;
  select pg_get_functiondef('public.log_subscription_login_change()'::regprocedure) into v_def;
  if position('exception when others' in lower(v_def)) = 0 then
    raise exception '변경 기록 트리거가 실패를 삼키지 않는다 — 기록 실패가 고객의 건너뛰기·해지를 막을 수 있다';
  end if;
  if position('billing_key' in lower(regexp_replace(v_def, 'new\.billing_key is distinct from old\.billing_key', '', 'gi'))) > 0 then
    raise exception '변경 기록 트리거가 빌링키 값을 남길 수 있다';
  end if;
  if has_function_privilege('authenticated', 'public.log_subscription_login_change()', 'execute')
     or has_function_privilege('anon', 'public.log_subscription_login_change()', 'execute') then
    raise exception '변경 기록 트리거 함수가 고객에게 실행 권한이 있다';
  end if;
end $$;
