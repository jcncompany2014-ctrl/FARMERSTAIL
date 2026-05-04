-- ============================================================================
-- Migration: push_log — 푸시 알림 이력 (보호자 알림 센터 + admin 디버깅)
-- ============================================================================
--
-- 보호자가 받은 푸시를 모아볼 수 있는 알림 센터 (/notifications) 의 데이터
-- 소스. lib/push.ts 의 pushToUser() 가 발송 직후 insert. read_at 컬럼으로
-- 읽음 처리. 90일 후 자동 삭제 cron 권장 (별도 phase).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text DEFAULT NULL,
  category text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_count smallint NOT NULL DEFAULT 0,
  read_at timestamptz DEFAULT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_log_user_recent_idx
  ON public.push_log (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS push_log_user_unread_idx
  ON public.push_log (user_id, sent_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_log_self_select ON public.push_log;
CREATE POLICY push_log_self_select ON public.push_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_log_self_update ON public.push_log;
CREATE POLICY push_log_self_update ON public.push_log
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_log_admin_select ON public.push_log;
CREATE POLICY push_log_admin_select ON public.push_log
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
