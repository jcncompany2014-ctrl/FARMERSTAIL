-- Migration: cron_health — cron 실행 결과 audit log
--
-- 솔로 운영자가 admin 대시보드에서 "어떤 cron 이 최근 실패했나" 한눈에 보게.
-- Vercel Cron Logs UI 가 기본 가시성 주지만, admin app 안에서 알람 카드로
-- 노출하려면 자체 테이블 필요.

CREATE TABLE IF NOT EXISTS public.cron_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  duration_ms integer,
  error_message text,
  result_summary jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_health_recent_idx
  ON public.cron_health (executed_at DESC);
CREATE INDEX IF NOT EXISTS cron_health_errors_idx
  ON public.cron_health (executed_at DESC)
  WHERE status = 'error';

-- 자동 정리 — 30일+ 오래된 row 는 cron 이 별도 cleanup 또는 retention policy.
-- 현재는 별도 cleanup cron 안 만들고, 운영 중 쿼리 비용 보고 결정.

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cron_health_admin_select ON public.cron_health;
CREATE POLICY cron_health_admin_select ON public.cron_health
  FOR SELECT USING (is_admin());

-- INSERT 는 service_role 만 (cron route 가 createAdminClient 로 insert).

COMMENT ON TABLE public.cron_health IS
  'cron 실행 audit log. admin 대시보드에서 최근 24h 실패 카운트 / 평균 duration 표시.';
