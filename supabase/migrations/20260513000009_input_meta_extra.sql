-- =============================================================================
-- P17 — 입력 메타 추가 컬럼 (Claude #3, #5, #6, #9, #10, #11)
-- =============================================================================
--
-- nullable 로 추가 — 기존 사용자에게 강제 입력 X. voice-guidelines §7
-- "모름" 옵션 정책.
-- =============================================================================

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS weight_measured_by text
    CHECK (
      weight_measured_by IS NULL
      OR weight_measured_by IN ('self', 'family', 'vet', 'unknown')
    );

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS activity_period text
    CHECK (
      activity_period IS NULL
      OR activity_period IN ('daily', 'weekly', 'monthly', 'unknown')
    );

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS walk_intensity text
    CHECK (
      walk_intensity IS NULL
      OR walk_intensity IN ('walk', 'jog', 'run', 'mixed', 'unknown')
    );

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS treat_frequency text
    CHECK (
      treat_frequency IS NULL
      OR treat_frequency IN ('none', 'rare', 'weekly', 'daily', 'unknown')
    );

-- 간식 종류 multi-select 는 text[]
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS treat_types text[];

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS human_food_given boolean;

-- 메타학습 결과 저장 — B-53 / B-88
-- 모듈 H 의 가중치 갱신 결과를 versioned 테이블에 저장.
CREATE TABLE IF NOT EXISTS public.algorithm_meta_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  weights jsonb NOT NULL,
  source text NOT NULL DEFAULT 'cron'
    CHECK (source IN ('cron', 'manual', 'vet_calibration')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_algorithm_meta_weights_version
  ON public.algorithm_meta_weights (version);
CREATE INDEX IF NOT EXISTS idx_algorithm_meta_weights_recent
  ON public.algorithm_meta_weights (created_at DESC);

ALTER TABLE public.algorithm_meta_weights ENABLE ROW LEVEL SECURITY;

-- 사용자에게는 비공개. service_role 만 INSERT, admin 만 SELECT.
DROP POLICY IF EXISTS "algorithm_meta_admin_select" ON public.algorithm_meta_weights;
CREATE POLICY "algorithm_meta_admin_select" ON public.algorithm_meta_weights
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMENT ON TABLE public.algorithm_meta_weights IS
  '발명 모듈 H — 메타학습 가중치 versioned 시계열. 월간 cron 이 적재.';
