-- =============================================================================
-- [C2] 메타학습 reward 영구화 — meta_learning_events / arm_stats
-- =============================================================================
--
-- exploration.ts 의 Arm<T> reward/trials 가 in-memory 만. 서버 재시작 또는
-- 다른 cron 호출 시 학습 결과 소실. push_log 와 결합해 영구 적재 + arm
-- 누적 통계 view 제공.
-- =============================================================================

-- 1) 학습 이벤트 — 각 push/nudge 발송 + 응답 결과
CREATE TABLE IF NOT EXISTS public.meta_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 어떤 시도 (arm) — exploration.ts 의 Arm.id
  arm_id text NOT NULL,
  -- 학습 컨텍스트 — 'push_timing' / 'message_template' / 'channel' 등
  context text NOT NULL,
  -- 보상 — 0~1 (CTR, open rate 등 정규화 점수)
  reward numeric(4,3) NOT NULL CHECK (reward >= 0 AND reward <= 1),
  -- 발송 대상 (집계 분석용, 개인 식별 X — push_log 와 다름)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 메타 — { hour: 9, dow: 1, template: 'no_problem', ... }
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mle_arm
  ON public.meta_learning_events (context, arm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mle_recent
  ON public.meta_learning_events (created_at DESC);

ALTER TABLE public.meta_learning_events ENABLE ROW LEVEL SECURITY;

-- admin 만 select. write 는 service_role.
DROP POLICY IF EXISTS "mle_admin_select" ON public.meta_learning_events;
CREATE POLICY "mle_admin_select" ON public.meta_learning_events
  FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2) Arm 누적 통계 view — exploration.ts 가 cohort 단위 reward/trials 조회
CREATE OR REPLACE VIEW public.arm_stats AS
SELECT
  context,
  arm_id,
  COUNT(*) AS trials,
  SUM(reward)::numeric(10,3) AS total_reward,
  AVG(reward)::numeric(5,3) AS mean_reward,
  MAX(created_at) AS last_used_at
FROM public.meta_learning_events
GROUP BY context, arm_id;

COMMENT ON TABLE public.meta_learning_events IS
  '메타학습 reward 영구 적재. exploration.ts 가 cohort 단위 학습 시 참조.';
COMMENT ON VIEW public.arm_stats IS
  'context+arm 별 누적 trials/reward 통계. 발명 모듈 H 학습 입력.';

-- 3) recordRewardEvent RPC — service_role 만 INSERT 편의
CREATE OR REPLACE FUNCTION public.record_reward_event(
  p_arm_id text,
  p_context text,
  p_reward numeric,
  p_user_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.meta_learning_events (
    arm_id, context, reward, user_id, meta
  ) VALUES (
    p_arm_id, p_context, LEAST(1, GREATEST(0, p_reward)), p_user_id, p_meta
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_reward_event TO authenticated;

COMMENT ON FUNCTION public.record_reward_event IS
  '메타학습 reward 1 row 적재. service_role 또는 authenticated user.';
