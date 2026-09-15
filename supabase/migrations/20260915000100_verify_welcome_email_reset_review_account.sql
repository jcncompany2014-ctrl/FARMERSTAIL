-- 검증용 — 심사원(촬영) 계정 1행만 "아직 환영 메일 안 받음"으로 되돌린다.
-- 환영 메일 연결(20260915000000)이 실제로 발송까지 가는지 실측하기 위해.
-- 이 계정의 메일은 사장님 gmail 로 오므로 도착까지 눈으로 확인할 수 있다.
-- (프로덕션에 MCP 로 먼저 적용했고, 로컬 히스토리를 맞추려고 파일도 둔다.)
update public.profiles
   set welcome_email_sent_at = null
 where id = (select id from auth.users where email = 'ian020529+review@gmail.com');
