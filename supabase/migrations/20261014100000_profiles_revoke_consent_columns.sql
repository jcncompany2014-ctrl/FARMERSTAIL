-- 광고 동의 칸 잠금 마무리 — 고객이 profiles 의 동의 칸을 직접 못 쓰게 (2026-10-14 점검 O8, 규칙219).
--
-- # 왜
-- 20261013100300 이 동의 기록(consent_log)의 고객 쓰기를 회수하고 동의 시각을 트리거로 서버 시각에 묶었다. 그런데
-- profiles 의 고객 UPDATE 화이트리스트(20260731000100)에는 동의 칸 다섯 개가 그대로 남아 있다
-- (운영 실측 2026-10-14 SELECT has_column_privilege('authenticated', 'public.profiles', 칸, 'UPDATE') = true):
--   agree_email · agree_email_at · agree_sms · agree_sms_at · marketing_policy_version
-- 고객이 REST 로 agree_email 을 바로 켜고 끌 수 있어서, 동의 값은 바뀌는데 **동의 기록(consent_log)은 남지 않는**
-- 상태가 만들어진다 — 광고 발송 근거(정보통신망법 §50)를 증명할 기록과 실제 값이 갈라진다. 약관 버전도 고객이 쓴다.
--
-- # 코드 확인 (2026-10-14 저장소 전수 grep — 고객 권한 쓰기 0건)
--   · 마이페이지·웹 알림 설정 토글   → set_marketing_consent RPC (SECURITY DEFINER, 소유자 postgres — 운영 실측)
--   · 가입 복원 applySignupProfile    → 같은 RPC (10/13 에 직접 쓰기를 뺐다)
--   · 가입 화면(start/join · StartSurvey) → auth 메타데이터(signUp options.data)만 — profiles 를 안 쓴다
--   · 탈퇴(app/api/account/delete)    → service_role
--   · 수신거부 웹훅(app/api/webhooks/resend) → service_role
--   · 그 밖에 profiles 를 쓰는 고객 경로(주문 신청 배송지·프로필 폼·age-gate·로그인 콜백)는 이 칸을 안 쓴다.
-- 그래서 회수해도 깨지는 화면이 없다. 동의는 앞으로도 RPC(동의 값·시각·기록을 한 번에)로만 바뀐다.
--
-- # 그대로 두는 것
--   · 다른 허용 칸(name · phone · zip · address · address_detail · birth_year · birth_month · birth_day · onboarded_at)
--   · 본인 SELECT(알림 설정 화면이 동의 값을 읽는다)
--
-- 다시 실행해도 안전하다(revoke 는 없는 권한이면 아무 일도 안 한다).

revoke update (agree_email, agree_email_at, agree_sms, agree_sms_at, marketing_policy_version)
  on public.profiles from authenticated, anon;

comment on column public.profiles.agree_email is
  '광고 메일 수신 동의. 고객은 직접 못 쓴다 — set_marketing_consent RPC(값·시각·consent_log 한 번에) 또는 service_role(탈퇴·수신거부 웹훅)만. 2026-10-14.';
comment on column public.profiles.agree_sms is
  '광고 문자 수신 동의. 고객은 직접 못 쓴다 — set_marketing_consent RPC 또는 service_role 만. 2026-10-14.';

-- 자기 검증
do $$
declare
  c text;
begin
  -- 표 단위 UPDATE 가 있으면 칸 회수가 소용없다(표 권한이 칸 권한을 덮는다).
  if has_table_privilege('authenticated', 'public.profiles', 'update')
     or has_table_privilege('anon', 'public.profiles', 'update') then
    raise exception 'profiles 에 고객 표 단위 UPDATE 권한이 있다 — 칸 화이트리스트가 무의미하다';
  end if;

  -- ① 동의 칸 — 고객(authenticated·anon)이 못 쓴다.
  foreach c in array array['agree_email', 'agree_email_at', 'agree_sms', 'agree_sms_at', 'marketing_policy_version'] loop
    if has_column_privilege('authenticated', 'public.profiles', c, 'update')
       or has_column_privilege('anon', 'public.profiles', c, 'update') then
      raise exception '고객이 profiles.% 를 아직 쓸 수 있다', c;
    end if;
  end loop;

  -- ② 다른 허용 칸 — 그대로 쓸 수 있다(배송지·이름·생년월일·온보딩이 깨지면 안 된다).
  foreach c in array array['name', 'phone', 'zip', 'address', 'address_detail', 'birth_year', 'birth_month', 'birth_day', 'onboarded_at'] loop
    if not has_column_privilege('authenticated', 'public.profiles', c, 'update') then
      raise exception '허용 칸 profiles.% 까지 막혔다 — 고객 화면이 깨진다', c;
    end if;
  end loop;

  -- ③ 본인 열람은 그대로.
  if not has_column_privilege('authenticated', 'public.profiles', 'agree_email', 'select') then
    raise exception '동의 값 열람(SELECT)까지 막혔다 — 알림 설정 화면이 깨진다';
  end if;

  -- ④ 동의를 바꾸는 유일한 고객 경로(RPC)가 살아 있다 — SECURITY DEFINER 라 칸 회수와 무관하게 쓴다.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_marketing_consent' and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
  ) then
    raise exception 'set_marketing_consent 가 SECURITY DEFINER 가 아니거나 고객이 부를 수 없다 — 동의 토글이 깨진다';
  end if;
end $$;
