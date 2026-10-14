-- 운영 경보함 — 사장님이 직접 처리해야 하는 경보를 어드민에 남긴다 (2026-10-14 어드민 B1, 규칙247).
--
-- # 왜
-- 서버 업무 경보(captureBusinessEvent)는 Sentry 로만 갔다. Sentry 메일은 사장님 Gmail 로 오지 않아서 '토스에서 직접 환불하세요',
-- '다음 박스에 알레르기 재료 — 구독을 멈췄어요' 같은 사람 일이 어디에도 남지 않았다. 고른 종류(lib/admin/alert-kinds 정본 목록)만
-- 이 표에도 적고, 어드민 /admin/alerts 에서 '처리함'(메모)으로 닫는다.
--
-- # 모양
--  · 종류(kind)·한국어 한 줄(message)·심각도(warning|error)·관련 주문/구독/고객/강아지 id·생긴 시각(first_seen_at)·
--    마지막 시각(last_seen_at)·횟수(occurrences)·처리 시각(resolved_at)·처리한 사람(resolved_by)·처리 메모(resolved_note).
--  · 같은 종류 + 같은 대상(target_key)이 24시간 안에 또 오면 새 줄 없이 횟수만 올린다(record_admin_alert — 잠금 안에서 판정).
--    처리한 경보는 묶지 않는다(처리 뒤에 다시 생기면 새 줄 — 다시 봐야 하는 일이다).
--  · context 는 id·숫자·짧은 코드만(앱의 sanitizeAlertContext 가 이름·이메일·전화·주소·키 값을 버린다).
--
-- # 권한
--  · 고객(anon·authenticated)은 쓰기 없음. 읽기는 관리자(is_admin())만.
--  · 쓰기는 서버(service_role)만 — 경보 기록은 record_admin_alert(실행 권한 service_role 만), '처리함'은 관리자 확인 뒤
--    app/api/admin/alerts/[id] 가 service_role 로.
--
-- ★적용 순서: 코드 배포 **전에** 적용해도 되고 뒤여도 된다 — 표·함수가 없으면 앱의 기록이 실패하지만 원래 동작은 계속되고
--   서버 로그·Sentry 에 '경보함 기록 실패'만 남는다(lib/admin/alert-record). 화면(/admin/alerts)은 조회 실패를 오류로 보여 준다.

create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (char_length(kind) between 1 and 120),
  severity text not null check (severity in ('warning', 'error')),
  message text not null check (char_length(message) between 1 and 300),
  target_key text not null default '' check (char_length(target_key) <= 120),
  order_id uuid,
  subscription_id uuid,
  user_id uuid,
  dog_id uuid,
  context jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1 check (occurrences >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_note text check (resolved_note is null or char_length(resolved_note) <= 1000)
);

comment on table public.admin_alerts is
  '운영 경보함 — 사장님이 직접 처리할 경보(lib/admin/alert-kinds 목록). 고객 접근 없음 · 관리자 읽기(is_admin) · 쓰기는 service_role(record_admin_alert·어드민 라우트). 2026-10-14.';

-- 같은 종류+대상의 열린 경보를 찾는 길(묶음 판정) · 목록(안 본 것 위, 최근 순).
create index if not exists admin_alerts_open_target_idx
  on public.admin_alerts (kind, target_key, last_seen_at desc)
  where resolved_at is null;
create index if not exists admin_alerts_list_idx
  on public.admin_alerts (resolved_at, last_seen_at desc);

alter table public.admin_alerts enable row level security;

revoke all on table public.admin_alerts from anon, authenticated;
grant select on table public.admin_alerts to authenticated;
grant all on table public.admin_alerts to service_role;

drop policy if exists admin_alerts_admin_select on public.admin_alerts;
create policy admin_alerts_admin_select on public.admin_alerts
  for select to authenticated
  using (public.is_admin());

-- 경보 한 건 기록 — 같은 종류+대상이 24시간 안에 열려 있으면 횟수만 올린다. 반환 = 그 경보 id.
-- SECURITY INVOKER: 부르는 쪽(service_role)의 권한으로 쓴다. 실행 권한은 service_role 만(아래).
create or replace function public.record_admin_alert(
  p_kind text,
  p_severity text,
  p_message text,
  p_target_key text default '',
  p_order_id uuid default null,
  p_subscription_id uuid default null,
  p_user_id uuid default null,
  p_dog_id uuid default null,
  p_context jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_kind text := btrim(coalesce(p_kind, ''));
  v_key text := left(btrim(coalesce(p_target_key, '')), 120);
  v_sev text := case when p_severity = 'error' then 'error' else 'warning' end;
  v_msg text := left(coalesce(nullif(btrim(p_message), ''), btrim(coalesce(p_kind, ''))), 300);
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
  v_id uuid;
begin
  if v_kind = '' then
    raise exception 'record_admin_alert: 종류(kind)가 비었다';
  end if;
  -- 문맥이 크면 버린다(앱이 이미 거르지만 한 번 더) — 기록 자체가 실패하는 것보다 낫다.
  if octet_length(v_ctx::text) > 8000 then
    v_ctx := jsonb_build_object('truncated', true);
  end if;

  -- 같은 종류+대상의 동시 기록을 줄 세운다(두 요청이 동시에 '없음'을 보고 두 줄을 만들지 않게).
  perform pg_advisory_xact_lock(hashtextextended('admin_alerts:' || v_kind || ':' || v_key, 0));

  select a.id into v_id
  from public.admin_alerts a
  where a.kind = v_kind
    and a.target_key = v_key
    and a.resolved_at is null
    and a.last_seen_at >= now() - interval '24 hours'
  order by a.last_seen_at desc
  limit 1
  for update;

  if v_id is not null then
    update public.admin_alerts a
    set occurrences = a.occurrences + 1,
        last_seen_at = now(),
        severity = case when a.severity = 'error' or v_sev = 'error' then 'error' else 'warning' end,
        message = v_msg,
        context = v_ctx,
        order_id = coalesce(p_order_id, a.order_id),
        subscription_id = coalesce(p_subscription_id, a.subscription_id),
        user_id = coalesce(p_user_id, a.user_id),
        dog_id = coalesce(p_dog_id, a.dog_id)
    where a.id = v_id;
    return v_id;
  end if;

  insert into public.admin_alerts (kind, severity, message, target_key, order_id, subscription_id, user_id, dog_id, context)
  values (v_kind, v_sev, v_msg, v_key, p_order_id, p_subscription_id, p_user_id, p_dog_id, v_ctx)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb) is
  '운영 경보함 기록 — 같은 종류+대상이 24시간 안에 열려 있으면 횟수만 올린다. service_role 전용(lib/admin/alert-record). 2026-10-14.';

revoke all on function public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb) to service_role;

-- 자기 검증 ① — 고객은 못 쓰고 익명은 못 읽고, 관리자 읽기 정책이 있고, 기록 함수는 service_role 만 부른다.
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_alerts', 'insert')
     or has_table_privilege('authenticated', 'public.admin_alerts', 'update')
     or has_table_privilege('authenticated', 'public.admin_alerts', 'delete')
     or has_table_privilege('anon', 'public.admin_alerts', 'select')
     or has_table_privilege('anon', 'public.admin_alerts', 'insert') then
    raise exception 'admin_alerts 에 고객 쓰기·익명 접근 권한이 남아 있다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_alerts'::regclass) then
    raise exception 'admin_alerts 에 RLS 가 꺼져 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_alerts' and policyname = 'admin_alerts_admin_select'
  ) then
    raise exception 'admin_alerts 관리자 읽기 정책이 없다';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_alerts' and cmd <> 'SELECT'
  ) then
    raise exception 'admin_alerts 에 읽기 말고 다른 정책이 있다(쓰기는 service_role 만)';
  end if;
  if has_function_privilege('anon', 'public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb)', 'execute') then
    raise exception 'record_admin_alert 를 고객이 부를 수 있다';
  end if;
  if not has_function_privilege('service_role', 'public.record_admin_alert(text, text, text, text, uuid, uuid, uuid, uuid, jsonb)', 'execute') then
    raise exception 'record_admin_alert 를 service_role 이 못 부른다';
  end if;
end $$;

-- 자기 검증 ② — 묶음이 실제로 동작한다(같은 종류+대상 두 번 = 한 줄·횟수 2·심각도는 더 높은 쪽, 다른 대상 = 새 줄).
-- 시험 줄은 같은 트랜잭션 안에서 지운다(남기지 않는다).
do $$
declare
  a uuid;
  b uuid;
  c uuid;
  n int;
  s text;
begin
  a := public.record_admin_alert('__selftest__', 'warning', '자기 검증', 'x');
  b := public.record_admin_alert('__selftest__', 'error', '자기 검증 2', 'x');
  c := public.record_admin_alert('__selftest__', 'warning', '자기 검증', 'y');
  if a is distinct from b then
    raise exception 'record_admin_alert: 같은 종류+대상인데 새 줄을 만들었다';
  end if;
  if c = a then
    raise exception 'record_admin_alert: 다른 대상을 같은 줄로 묶었다';
  end if;
  select occurrences, severity into n, s from public.admin_alerts where id = a;
  if n <> 2 or s <> 'error' then
    raise exception 'record_admin_alert: 횟수(%)·심각도(%)가 틀렸다', n, s;
  end if;
  delete from public.admin_alerts where kind = '__selftest__';
end $$;
