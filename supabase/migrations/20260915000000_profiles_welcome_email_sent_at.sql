-- profiles.welcome_email_sent_at — 가입 환영 메일을 보냈다는 표시.
--
-- 왜: 환영 메일 템플릿(lib/email notifyWelcome)은 있는데 **부르는 코드가
-- 없어서** 서비스 시작부터 한 통도 안 나갔다(2026-09-15 검수). 7월에
-- "/api/auth/welcome-email 을 부르는 client 가 없다"며 API 를 지웠는데,
-- 정작 고쳐야 할 것은 호출처였다. 이제 첫 홈 진입에서 보낸다.
--
-- 프로필은 auth 트리거(handle_new_user)가 만들어 앱 코드에 "가입 직후"
-- 지점이 없다 — 이메일·카카오·애플 세 경로가 전부 홈으로 모이니 거기서
-- 잡되, 두 번 안 보내려면 표시가 필요하다. Resend idempotencyKey 는 24시간
-- 창이라 그 뒤 홈에 또 들어오면 또 간다 — 그래서 DB 에 남긴다.
--
-- 기존 회원은 now() 로 채운다. 3주 전에 가입한 분에게 "가입을 환영해요"가
-- 오늘 가면 이상하다. 이 마이그레이션 이후 가입자부터 받는다.
--
-- 권한: profiles 는 컬럼 화이트리스트(authenticated 가 UPDATE 할 수 있는
-- 칸이 명시)라 새 칸은 자동으로 고객 손이 안 닿는다 — 서버(service_role)만
-- 쓴다. 실측 has_column_privilege 로 확인함.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

update public.profiles
   set welcome_email_sent_at = now()
 where welcome_email_sent_at is null;

comment on column public.profiles.welcome_email_sent_at is
  '가입 환영 메일 발송 시각. null = 아직 안 보냄(첫 홈 진입에서 서버가 선점 후 발송). 기존 회원은 도입 시 now() 로 채움.';
