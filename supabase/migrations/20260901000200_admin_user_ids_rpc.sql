-- 2026-09-01 출시 전 전수 감사 — 운영 알림이 29회 전부 0명에게 갔다.
--
-- daily-briefing 과 quality-check-reminder 가 수신자를 `profiles.role = 'admin'`
-- 으로 찾는데, 관리자 판정 정본은 2026-08 감사(R101-C) 이후 **app_metadata.role**
-- 하나다(lib/auth/admin — profiles fallback 을 self-elevation 때문에 제거했다).
-- 실측: profiles.role='admin' 0명 / app_metadata.role='admin' 1명.
-- 그래서 두 크론은 `sent: 0` 인데 status='success' 로 집계됐다 — 지표는 초록인데
-- 사장님은 브리핑도 자가품질검사 알림도 한 번도 못 받았다.
--
-- auth.users 는 서버 클라이언트로 직접 조회할 수 없으므로 RPC 로 연다.
-- ⚠️ DB 함수 작성 규칙(2026-07 보안 감사): search_path 고정 + PUBLIC 실행권한
--    회수 + 필요한 롤에만 GRANT. 이 함수는 크론(service_role) 전용이다.

create or replace function public.admin_user_ids()
returns table (id uuid)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where u.raw_app_meta_data ->> 'role' = 'admin'
$$;

-- 기본 GRANT(PUBLIC)를 반드시 회수한다 — 안 하면 anon 도 관리자 계정 id 목록을
-- 뽑을 수 있다(2026-07 에 실제로 났던 유출 모양).
revoke execute on function public.admin_user_ids() from public;
revoke execute on function public.admin_user_ids() from anon;
revoke execute on function public.admin_user_ids() from authenticated;
grant execute on function public.admin_user_ids() to service_role;
