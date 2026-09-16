-- 검증용 — 심사원(촬영) 계정 1행만 "아직 환영 메일 안 받음"으로 되돌렸다.
-- 환영 메일 연결(20260915000000)이 실제로 발송까지 가는지 실측하기 위해.
-- 프로덕션에 2026-09-15 12:23 UTC 에 MCP 로 적용됐고 검증도 끝났다(발송 확인).
-- ★재실행 금지 — 그래서 본문을 비웠다. 다시 돌면 심사원 계정에 환영 메일이
--   한 통 더 간다. 원문:
--   update public.profiles set welcome_email_sent_at = null
--    where id = (select id from auth.users where email = 'ian020529+review@gmail.com');
select 1; -- no-op (기록용)
