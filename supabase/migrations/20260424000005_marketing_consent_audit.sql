-- 20260424000005_marketing_consent_audit.sql
--
-- Marketing consent 를 이메일·SMS 별로 분리하고 감사 로그를 남긴다.
-- 정보통신망법 §50 ⑦ 은 "수신동의 일자를 확인하고 그 결과를 수신자에게 통지"
-- 하도록 의무화한다 → 우리가 언제 받았는지 명시적으로 기록 필요.
--
-- 기존 상태
-- ────────
-- profiles.agree_email (bool)
-- profiles.agree_sms   (bool)
-- → 플래그만 있고 timestamp 나 policy version 근거가 없어 감사 대응 곤란.
--
-- 추가
-- ────
-- • profiles.agree_email_at / agree_sms_at (timestamptz)
--   현재 상태가 true 로 바뀐 가장 최근 시각. opt-out 시 null 로 초기화.
-- • profiles.marketing_policy_version (text)
--   가장 최근 동의 시점의 마케팅 수신 약관 버전. 약관 개정 시 재동의 유도용.
-- • consent_log (append-only 테이블)
--   channel(email|sms), granted(bool), granted_at, policy_version, source
--   감사/민원/과태료 대응의 1차 증빙.

BEGIN;

alter table public.profiles
  add column if not exists agree_email_at timestamptz,
  add column if not exists agree_sms_at timestamptz,
  add column if not exists marketing_policy_version text;

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'email' | 'sms' — 채널. push 는 별도 push_preferences 테이블이 있음.
  channel text not null check (channel in ('email', 'sms')),
  -- true = 동의, false = 철회
  granted boolean not null,
  -- 동의/철회가 발생한 정확한 시각 (서버 기준 UTC)
  granted_at timestamptz not null default now(),
  -- 당시 적용된 마케팅 수신 약관 버전. 'v1' 같은 라벨.
  policy_version text,
  -- 동의 수집 경로 — 'signup' | 'mypage' | 'admin' | 'migration' | ...
  source text,
  -- IP 는 감사용으로만, 30일 후 퍼지해도 무방.
  ip inet,
  user_agent text
);

create index if not exists consent_log_user_time
  on public.consent_log(user_id, granted_at desc);

-- RLS — 본인만 자기 로그 조회. 관리자는 서비스롤 또는 is_admin 으로 우회.
alter table public.consent_log enable row level security;

drop policy if exists consent_log_self_select on public.consent_log;
create policy consent_log_self_select on public.consent_log
  for select
  using (auth.uid() = user_id);

-- admin 전체 조회용
drop policy if exists consent_log_admin_select on public.consent_log;
create policy consent_log_admin_select on public.consent_log
  for select
  using (public.is_admin());

-- insert 는 서비스 로직에서만 (RPC 를 통해). 개별 유저의 insert 는 허용하되
-- user_id 는 반드시 본인 것이어야 하고 과거 시각으로 위조 못 하도록 granted_at
-- 은 default 사용을 강제.
drop policy if exists consent_log_self_insert on public.consent_log;
create policy consent_log_self_insert on public.consent_log
  for insert
  with check (auth.uid() = user_id);

-- 편의용 RPC: 이메일/SMS 수신동의 토글. profiles + consent_log 를 한 번에 갱신.
create or replace function public.set_marketing_consent(
  p_channel text,
  p_granted boolean,
  p_policy_version text default null,
  p_source text default 'mypage'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_col text;
  v_col_at text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_channel not in ('email', 'sms') then
    raise exception 'INVALID_CHANNEL';
  end if;

  if p_channel = 'email' then
    update public.profiles
      set agree_email = p_granted,
          agree_email_at = case when p_granted then now() else null end,
          marketing_policy_version = coalesce(p_policy_version, marketing_policy_version)
      where id = v_uid;
  else
    update public.profiles
      set agree_sms = p_granted,
          agree_sms_at = case when p_granted then now() else null end,
          marketing_policy_version = coalesce(p_policy_version, marketing_policy_version)
      where id = v_uid;
  end if;

  insert into public.consent_log (user_id, channel, granted, policy_version, source)
    values (v_uid, p_channel, p_granted, p_policy_version, p_source);
end;
$$;

grant execute on function public.set_marketing_consent(text, boolean, text, text) to authenticated;

COMMIT;
