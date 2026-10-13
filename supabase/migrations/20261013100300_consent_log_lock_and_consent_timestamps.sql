-- 광고 동의 기록 잠금 (2026-10-13 점검, 규칙197).
--
-- # 왜
-- 광고성 정보 수신 동의 기록(consent_log)은 "언제 동의했나"를 증명하는 법정 자료다(정보통신망법 §50).
-- 그런데 운영 권한을 보면(2026-10-13 SELECT) anon·authenticated 가 consent_log 에 INSERT·UPDATE·DELETE 표 권한을
-- 갖고 있고, RLS 'consent_log_self_insert' 가 본인 행 INSERT 를 허용했다 — 고객이 **granted_at 을 아무 날짜로**
-- 넣은 동의·철회 기록을 직접 만들 수 있었다. profiles.agree_email_at·agree_sms_at 도 고객 UPDATE 칸이라
-- 동의 시각을 과거·미래로 바꿀 수 있었다.
--
-- # 어떻게
-- ① consent_log: anon·authenticated 의 INSERT·UPDATE·DELETE·TRUNCATE 회수 + 본인 INSERT 정책 삭제.
--    기록은 서버만 쓴다 — 이메일·SMS 는 기존 SECURITY DEFINER set_marketing_consent(시각 = now()),
--    앱 푸시는 서버 라우트(app/api/push/preferences)가 service_role 로(시각 = 칸 기본값 now()).
--    본인 SELECT(열람권·내려받기)는 그대로 둔다.
-- ② profiles: 동의 시각 칸은 트리거가 정한다 — 동의가 켜지거나 시각을 건드리면 now(), 꺼지면 null,
--    동의를 안 건드린 수정은 그대로. 고객이 넣은 날짜는 무시된다. (set_marketing_consent 는 원래 now() 를
--    넣으므로 결과가 같다. 탈퇴·수신거부 웹훅은 false·null 이라 null 그대로.)
--
-- ★적용 순서: **새 코드 배포 뒤에** 적용한다. 옛 코드(가입 복원 applySignupProfile·푸시 설정 라우트)는
--   고객 권한으로 consent_log 에 직접 INSERT 하므로, 먼저 적용하면 그 사이 가입 동의 기록이 빠진다
--   (오류는 삼켜져 가입은 된다). 새 코드는 RPC·service_role 로 쓰므로 이 파일 적용 전후 모두 동작한다.
--
-- 다시 실행해도 안전하다(revoke·drop if exists·create or replace·drop trigger if exists).

-- ① consent_log 잠금
revoke insert, update, delete, truncate on table public.consent_log from anon, authenticated;
drop policy if exists consent_log_self_insert on public.consent_log;

-- ② 동의 시각 = 서버 시각
create or replace function public.enforce_marketing_consent_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.agree_email_at := case when coalesce(new.agree_email, false) then now() else null end;
    new.agree_sms_at := case when coalesce(new.agree_sms, false) then now() else null end;
    return new;
  end if;

  -- 이메일 — 동의 값이나 시각을 건드렸을 때만 다시 정한다(다른 칸만 고친 수정은 시각 그대로).
  if new.agree_email is distinct from old.agree_email
     or new.agree_email_at is distinct from old.agree_email_at then
    new.agree_email_at := case when coalesce(new.agree_email, false) then now() else null end;
  end if;

  -- SMS — 같은 규칙.
  if new.agree_sms is distinct from old.agree_sms
     or new.agree_sms_at is distinct from old.agree_sms_at then
    new.agree_sms_at := case when coalesce(new.agree_sms, false) then now() else null end;
  end if;

  return new;
end;
$$;

comment on function public.enforce_marketing_consent_timestamps() is
  '광고 동의 시각(agree_email_at·agree_sms_at)은 서버 시각만 — 고객이 넣은 날짜 무시(2026-10-13 규칙197).';

revoke all on function public.enforce_marketing_consent_timestamps() from public, anon, authenticated;

drop trigger if exists profiles_enforce_consent_timestamps on public.profiles;
create trigger profiles_enforce_consent_timestamps
  before insert or update of agree_email, agree_email_at, agree_sms, agree_sms_at
  on public.profiles
  for each row execute function public.enforce_marketing_consent_timestamps();

-- 자기 검증
do $$
begin
  if has_table_privilege('authenticated', 'public.consent_log', 'insert')
     or has_table_privilege('anon', 'public.consent_log', 'insert')
     or has_table_privilege('authenticated', 'public.consent_log', 'update')
     or has_table_privilege('authenticated', 'public.consent_log', 'delete') then
    raise exception 'consent_log 에 고객 쓰기 권한이 남아 있다';
  end if;
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'consent_log'
      and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE')
  ) then
    raise exception 'consent_log 에 고객 칸 단위 쓰기 권한이 남아 있다';
  end if;
  if not has_table_privilege('authenticated', 'public.consent_log', 'select') then
    raise exception 'consent_log 본인 열람(SELECT)까지 막혔다 — 열람권·내려받기가 깨진다';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_enforce_consent_timestamps'
  ) then
    raise exception '동의 시각 트리거가 없다';
  end if;
end $$;
