-- 환불 데드레터 가시성 — payment_refund_queue 관리자 read 정책.
--
-- 배경: refund-retry cron 은 MAX_ATTEMPTS 초과 시 status='permanently_failed'
-- 로 표시하고 Sentry alert(alertRefundFailure)를 보낸다. 그러나 솔로 운영자가
-- Sentry 를 항상 보지 않으면 "돈이 안 돌아간 채" 방치될 수 있다. 또 이 테이블은
-- RLS-on-no-policy(서버전용 deny-all)라 admin 페이지가 조회조차 못 했다(advisor
-- rls_enabled_no_policy 로도 잡힘).
--
-- 조치: 관리자만 SELECT 가능하게 정책 추가 → /admin/refunds 에 "영구 실패(수동
-- 처리 필요)" 섹션으로 노출. write 는 여전히 service_role 전용(cron).
-- ※ 적용은 창업자 검토 후.

BEGIN;

CREATE POLICY payment_refund_queue_admin_read ON public.payment_refund_queue
  FOR SELECT USING (public.is_admin(auth.uid()));

COMMIT;
