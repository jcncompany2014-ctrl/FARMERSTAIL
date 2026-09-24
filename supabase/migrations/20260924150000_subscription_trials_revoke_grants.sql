-- 체험단 가격표 기본 GRANT 회수 (출시 점검 세션 제보, 2026-09-24 · MCP 적용됨)
-- RLS 정책 0 이라 실접근은 이미 막혀 있지만, "쓸 수 없게 만드는 층위를 먼저"
-- (돈·데이터 규칙 3) 원칙대로 테이블 권한 자체를 회수한다 — 나중에 누가
-- 정책을 하나 추가해도 anon/authenticated 는 여전히 못 만진다.
-- 적용 후 실측: pg_class.relacl = {postgres, service_role} 만 남음.
revoke all on table public.subscription_trials from anon, authenticated;
