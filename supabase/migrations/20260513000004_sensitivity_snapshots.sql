-- =============================================================================
-- 반사실 sensitivity snapshot — D8.3 phase.
-- =============================================================================
--
-- 매주 cron 이 활성 dog 의 sensitivityAnalysis 결과를 저장. 메타학습
-- (모듈 H) 의 재료로 사용 — "어떤 변수가 권고에 가장 큰 영향을 줬는지"
-- 시계열 패턴.
--
-- # 데이터 모양
--  baseline_state jsonb  — feedGramsModel 의 입력 snapshot
--  results        jsonb  — sensitivityAnalysis 출력 array
--  top_variable   text   — |delta| 최대 변수
--  top_delta      int    — top_variable 의 delta (그램)
--
-- # 멱등성
-- (dog_id, snapshot_at::date) UNIQUE — 같은 날 두 번 실행해도 중복 저장 X.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dog_sensitivity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  -- feedGramsModel 입력 객체
  baseline_state jsonb NOT NULL,
  -- sensitivityAnalysis 결과 array (CounterfactualOutcome[])
  results jsonb NOT NULL,
  -- |delta| 최대 변수 — 메타학습 ground-truth 로 사용
  top_variable text NOT NULL,
  top_delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensitivity_dog
  ON public.dog_sensitivity_snapshots (dog_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitivity_user
  ON public.dog_sensitivity_snapshots (user_id, snapshot_at DESC);
-- 같은 날 중복 방지 — date_trunc 으로 일별 1건
CREATE UNIQUE INDEX IF NOT EXISTS uq_sensitivity_dog_day
  ON public.dog_sensitivity_snapshots (dog_id, ((snapshot_at AT TIME ZONE 'Asia/Seoul')::date));

ALTER TABLE public.dog_sensitivity_snapshots ENABLE ROW LEVEL SECURITY;

-- 본인 row 만 select (대시보드 / 분석 페이지에서 자기 trend 확인)
DROP POLICY IF EXISTS "sensitivity_self_select" ON public.dog_sensitivity_snapshots;
CREATE POLICY "sensitivity_self_select" ON public.dog_sensitivity_snapshots
  FOR SELECT USING (auth.uid() = user_id);

-- write 은 admin (service_role) 만 — cron 이 service_role 로 insert.
-- (별도 policy 없음 — RLS 활성 + service_role 은 BYPASS)

COMMENT ON TABLE public.dog_sensitivity_snapshots IS
  '반사실 sensitivity 결과 시계열. 주간 cron 이 활성 dog 별 1건 저장.';
