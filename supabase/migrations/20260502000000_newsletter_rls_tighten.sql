-- ============================================================================
-- Migration: newsletter_subscribers RLS tighten — close mass-update loophole
-- ============================================================================
--
-- 문제
-- ----
-- 20260425000009 가 anon update 를 token 검증 없이 너무 넓게 열어두었음:
--
--   create policy "newsletter confirm via token" ... for update
--     using (confirm_token is not null)
--     with check (status in ('pending','confirmed'))
--
-- USING 절은 row 를 "보일 수 있는 row" 로 좁히지만 외부 입력값(token)을
-- 받을 수 없어 "confirm_token IS NOT NULL" 까지밖에 못 좁힌다. 라우트가
-- `.eq('confirm_token', token)` 으로 1행만 좁히는 건 정상 동선 한정 — 공격자가
-- supabase-js anon 키로 raw 호출하면:
--
--   supabase.from('newsletter_subscribers').update({status:'confirmed'})
--
-- 한 줄로 **모든 pending row** 가 confirmed 로 변환된다. 결과:
--   1) double opt-in 우회 — 동의 없는 이메일로 newsletter 발송
--   2) Resend 도메인 평판 손상 / 스팸 신고 폭증
--   3) unsubscribe_token 쪽도 같은 패턴 → 모든 confirmed 가 일괄 unsubscribed
--      (사용자 발송 누락 + 운영 사고)
--
-- 해결
-- ----
-- token 매칭은 RLS 로는 강제할 수 없는 게 정답이라, **anon UPDATE 자체를 막고**
-- confirm / unsubscribe 라우트는 service-role 클라이언트(createAdminClient) 로
-- 우회해 token 매칭 + status 전환만 1행 update.
--
-- service-role 키는 서버 전용이라 사용자가 raw 호출 못 하고, 라우트의 정상
-- 흐름만 통과한다. 라우트 자체는 token format 정규식 + .eq() 매칭 + maybeSingle
-- 로 이미 1행만 노린다.
-- ============================================================================

BEGIN;

-- 두 개 anon UPDATE 정책 모두 제거. admin-only 정책 ("newsletter admin all") 은
-- 그대로 유지 — 운영자가 대시보드에서 손볼 수 있어야 함.
DROP POLICY IF EXISTS "newsletter confirm via token" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter unsubscribe via token" ON public.newsletter_subscribers;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (참고)
-- ============================================================================
-- 1) 잔존 정책 점검:
--    SELECT policyname, cmd, roles
--    FROM pg_policies
--    WHERE schemaname='public' AND tablename='newsletter_subscribers';
--    → "newsletter public insert" (anon/auth INSERT)
--    → "newsletter admin all" (auth ALL via app_metadata role)
--    → token 기반 UPDATE 정책은 0 rows 여야 함
--
-- 2) anon 키로 mass-confirm 시도:
--    PGRST 응답이 "permission denied" 또는 0 row affected 면 OK
--
-- 3) confirm/unsubscribe 라우트 동작:
--    기존 토큰으로 GET /api/newsletter/confirm?token=... → 정상 confirmed
--    (라우트가 createAdminClient 로 우회)
