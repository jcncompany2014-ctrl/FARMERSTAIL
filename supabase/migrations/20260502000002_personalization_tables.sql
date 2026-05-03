-- ============================================================================
-- Migration: dog_formulas + dog_checkins — personalization 운영 인프라
-- ============================================================================
--
-- 배경
-- ----
-- 5종 화식 + 토퍼를 강아지별 비율로 조합하는 personalization 시스템에서,
-- 매 cycle (보통 4주마다) 의 처방과 보호자 응답을 추적해야 알고리즘이 점점
-- 정확해진다.
--
-- 본 마이그레이션이 추가하는 두 테이블:
--
--   1. dog_formulas
--      각 강아지의 매 cycle 처방을 저장. firstBox.ts 알고리즘 출력 + 사용자
--      조정 결과 + 적용 일자. 이력 테이블이라 row 가 cycle 마다 누적.
--
--   2. dog_checkins
--      매 cycle 2/4주차에 보호자가 응답하는 변/털/식욕 폼 저장. 다음 cycle
--      알고리즘 input. 응답 안 오면 row 없음 — 그게 곧 신호 (응답률 추적).
--
-- 두 테이블은 cycle_number 로 join 가능 — formulas.cycle = N 의 다음 처방을
-- checkins.cycle = N 의 응답 기반으로 결정.
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- dog_formulas — 매 cycle 처방
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dog_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- cycle_number: 같은 강아지의 (1, 2, 3, ...) 누적. UNIQUE 로 중복 방지.
  cycle_number smallint NOT NULL CHECK (cycle_number >= 1),

  -- 알고리즘 결정 비율. 5종 라인 + 토퍼 2종을 jsonb 로 통일.
  --   { lineRatios: { basic: 0.3, weight: 0, ..., joint: 0.6 },
  --     toppers: { protein: 0.05, vegetable: 0.10 } }
  -- 합 1.0 검증은 application layer (firstBox.ts) 가 보장 — DB 는 schema 만.
  formula jsonb NOT NULL,

  -- reasoning: Reasoning[] 배열. UI chip / audit / 디버그용.
  reasoning jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 전환 전략 — 'aggressive' | 'gradual' | 'conservative'
  transition_strategy text NOT NULL
    CHECK (transition_strategy IN ('aggressive', 'gradual', 'conservative')),

  -- 알고리즘 버전. 룰 변경 시 trace 가능. 'v1.0.0' 같은 semver.
  algorithm_version text NOT NULL,

  -- 사용자가 추천 비율을 직접 수정했는지. 첫 출력은 false, 사용자가 슬라이더로
  -- 조정하면 true + reasoning 에 "사용자 조정" 추가.
  user_adjusted boolean NOT NULL DEFAULT false,

  -- 영양 calc 결과 snapshot. 이후 영양 가이드라인 변경 시에도 당시 값 유지.
  daily_kcal smallint NOT NULL CHECK (daily_kcal > 0),
  daily_grams smallint NOT NULL CHECK (daily_grams > 0),

  -- 처방 적용 cycle 의 시작/끝 일자 (UTC).
  applied_from date,
  applied_until date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 강아지가 같은 cycle 번호로 두 번 처방 받지 않게 — cron 멱등성.
  UNIQUE (dog_id, cycle_number)
);

COMMENT ON TABLE public.dog_formulas IS
  '강아지별 매 cycle 처방 이력. firstBox.ts 알고리즘 출력 + 사용자 조정.
   cycle_number 로 dog_checkins 와 join 해 다음 cycle 알고리즘 input 생성.';

COMMENT ON COLUMN public.dog_formulas.formula IS
  '{ lineRatios: { basic, weight, skin, premium, joint }, toppers: { protein, vegetable } } 형태 jsonb.
   합 1.0 검증은 application layer (firstBox.ts).';

COMMENT ON COLUMN public.dog_formulas.reasoning IS
  'Reasoning[] 배열. 각 원소: { trigger, action, chipLabel, priority, ruleId }.
   UI 가 priority 오름차순으로 chip 노출.';

COMMENT ON COLUMN public.dog_formulas.user_adjusted IS
  'true 면 사용자가 슬라이더로 비율 조정. UI 에 "사용자 조정됨" 배지 표시.
   알고리즘 정확도 측정 시 user_adjusted=true 비율이 핵심 KPI.';

CREATE INDEX IF NOT EXISTS dog_formulas_dog_idx
  ON public.dog_formulas (dog_id, cycle_number DESC);

CREATE INDEX IF NOT EXISTS dog_formulas_user_idx
  ON public.dog_formulas (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dog_formulas_strategy_idx
  ON public.dog_formulas (transition_strategy)
  WHERE transition_strategy IS NOT NULL;

-- updated_at 자동 갱신 trigger.
DROP TRIGGER IF EXISTS dog_formulas_updated_at_tr ON public.dog_formulas;
CREATE TRIGGER dog_formulas_updated_at_tr
  BEFORE UPDATE ON public.dog_formulas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — 본인 row 만.
ALTER TABLE public.dog_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dog_formulas_self_select ON public.dog_formulas;
CREATE POLICY dog_formulas_self_select ON public.dog_formulas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_formulas_self_insert ON public.dog_formulas;
CREATE POLICY dog_formulas_self_insert ON public.dog_formulas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_formulas_self_update ON public.dog_formulas;
CREATE POLICY dog_formulas_self_update ON public.dog_formulas
  FOR UPDATE USING (auth.uid() = user_id);

-- 운영자 (admin) 는 전체 read — 알고리즘 분석 / 운영 인사이트.
DROP POLICY IF EXISTS dog_formulas_admin_select ON public.dog_formulas;
CREATE POLICY dog_formulas_admin_select ON public.dog_formulas
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ──────────────────────────────────────────────────────────────────────────
-- dog_checkins — 2/4주차 체크인 응답
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dog_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 어떤 cycle 에 대한 체크인인지. dog_formulas.cycle_number 와 매칭.
  cycle_number smallint NOT NULL CHECK (cycle_number >= 1),

  -- 어느 시점 체크인 — 'week_2' 또는 'week_4'.
  -- week_2: 위장 적응 신호 위주. week_4: 다음 cycle 결정용 종합 평가.
  checkpoint text NOT NULL CHECK (checkpoint IN ('week_2', 'week_4')),

  -- Bristol Stool 1~7 (4 = 이상). 설문 baseline 과 동일 척도.
  stool_score smallint
    CHECK (stool_score IS NULL OR (stool_score BETWEEN 1 AND 7)),

  -- 털 상태 1~5 (5 = 매우 윤기).
  coat_score smallint
    CHECK (coat_score IS NULL OR (coat_score BETWEEN 1 AND 5)),

  -- 식욕 1~5 (5 = 매우 왕성).
  appetite_score smallint
    CHECK (appetite_score IS NULL OR (appetite_score BETWEEN 1 AND 5)),

  -- 종합 만족도 1~5 (5 = 매우 만족). 4주차 주요 신호.
  overall_satisfaction smallint
    CHECK (overall_satisfaction IS NULL OR (overall_satisfaction BETWEEN 1 AND 5)),

  -- 자유 텍스트 — 보호자 코멘트.
  free_text text,

  -- 사진 URL (Supabase Storage) — 미래에 vision 분석. v1 은 저장만.
  photo_urls text[] DEFAULT ARRAY[]::text[],

  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 cycle 의 같은 checkpoint 는 중복 응답 막음.
  UNIQUE (dog_id, cycle_number, checkpoint)
);

COMMENT ON TABLE public.dog_checkins IS
  '매 cycle 2/4주차 보호자 체크인 응답. 다음 cycle 알고리즘 input. 응답
   안 오면 row 없음 — 응답률 자체가 중요 신호.';

COMMENT ON COLUMN public.dog_checkins.checkpoint IS
  '''week_2'' = 위장 적응 신호 (변 무름 etc), ''week_4'' = 다음 cycle
   결정용 종합 평가.';

COMMENT ON COLUMN public.dog_checkins.photo_urls IS
  'Supabase Storage 경로 또는 public URL 배열. v1 은 저장만, v2 부터 Claude
   vision 으로 자동 stool/coat 점수 추출.';

CREATE INDEX IF NOT EXISTS dog_checkins_dog_idx
  ON public.dog_checkins (dog_id, cycle_number, checkpoint);

CREATE INDEX IF NOT EXISTS dog_checkins_user_idx
  ON public.dog_checkins (user_id, responded_at DESC);

-- 운영자 응답률 분석용 — 응답된 cycle 만 집계.
CREATE INDEX IF NOT EXISTS dog_checkins_checkpoint_idx
  ON public.dog_checkins (checkpoint, responded_at DESC);

ALTER TABLE public.dog_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dog_checkins_self_select ON public.dog_checkins;
CREATE POLICY dog_checkins_self_select ON public.dog_checkins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_checkins_self_insert ON public.dog_checkins;
CREATE POLICY dog_checkins_self_insert ON public.dog_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_checkins_self_update ON public.dog_checkins;
CREATE POLICY dog_checkins_self_update ON public.dog_checkins
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_checkins_admin_select ON public.dog_checkins;
CREATE POLICY dog_checkins_admin_select ON public.dog_checkins
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;

-- ============================================================================
-- 검증 쿼리 (참고)
-- ============================================================================
-- 1) 테이블 생성 확인:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name IN ('dog_formulas', 'dog_checkins');
--
-- 2) RLS 정책 점검:
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename IN ('dog_formulas','dog_checkins');
--
-- 3) 응답률 (운영 후):
--    SELECT cycle_number, checkpoint, count(*)
--    FROM dog_checkins
--    GROUP BY cycle_number, checkpoint
--    ORDER BY cycle_number, checkpoint;
--
-- 4) user_adjusted 비율 (알고리즘 정확도 KPI):
--    SELECT
--      count(*) FILTER (WHERE user_adjusted) AS adjusted,
--      count(*) AS total,
--      round(100.0 * count(*) FILTER (WHERE user_adjusted) / count(*), 1) AS adjusted_pct
--    FROM dog_formulas;
