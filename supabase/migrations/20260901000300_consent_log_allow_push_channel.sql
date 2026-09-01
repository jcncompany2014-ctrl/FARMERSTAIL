-- 2026-09-01 출시 전 전수 감사 — 광고성 앱 푸시의 동의 증적이 남지 않았다.
--
-- 이메일·SMS 는 가입 시 consent_log 에 {channel, granted, granted_at,
-- policy_version, source} 를 남기는데(lib/auth/applySignupProfile), 앱 푸시의
-- 마케팅 토글(push_preferences.notify_marketing)만 값 하나로 끝났다. 분쟁이 나면
-- "동의받았다"를 증명할 방법이 없다 — 정보통신망법 §50.
--
-- 그런데 채널 CHECK 가 email/sms/consent_level/newsletter 만 허용해서 'push' 를
-- 넣으면 INSERT 가 거부된다. 코드만 고치고 이걸 안 고쳤으면 증적 기록이 조용히
-- 전부 실패했을 것이다(마이그레이션은 tsc 가 안 봐 주는 미검증 코드다).
alter table public.consent_log drop constraint if exists consent_log_channel_check;
alter table public.consent_log add constraint consent_log_channel_check
  check (channel = any (array['email'::text, 'sms'::text, 'push'::text, 'consent_level'::text, 'newsletter'::text]));
