-- ============================================================================
-- Migration: surveys 임상 정밀화 v1.3 (대형견 puppy Ca + CKD IRIS staging)
-- ============================================================================
--
-- 알고리즘 v1.3 의 임상 안전 룰 두 개를 위해 설문에 두 필드 추가:
--
--   1. expected_adult_weight_kg
--      대형견 puppy 의 Ca:P 상한 룰 발화 — AAFCO 2024 Dog Food Nutrient
--      Profiles "Growth (Large size)" 가 ≥25kg 성견을 대형견으로 정의.
--      Ca 1.8% DM 상한 (DOD/HOD/패노스토시스 예방). NRC 2006 ch.15.
--      알고리즘은 puppy (<18 개월) + ≥25kg 성견 예상 = 대형견 puppy 분기.
--
--   2. iris_stage
--      만성 신장질환 (CKD) 의 IRIS staging — Stage 1-2 는 단백질 정상 +
--      인 제한, Stage 3+ 는 단백질 제한. 현재 알고리즘은 입력 없이 일률
--      Premium 0% 처리 → Stage 1-2 견 단백질 과제한 → 근감소증 위험.
--      IRIS (2019) "Staging of CKD Guidelines" www.iris-kidney.com.
--
-- 둘 다 nullable — 미입력 시 알고리즘은 보수적 fallback (현 v1.2 동작).
-- ============================================================================

BEGIN;

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS expected_adult_weight_kg numeric(5, 2)
    CHECK (expected_adult_weight_kg IS NULL
      OR (expected_adult_weight_kg >= 0.5 AND expected_adult_weight_kg <= 100)),
  ADD COLUMN IF NOT EXISTS iris_stage smallint
    CHECK (iris_stage IS NULL OR (iris_stage BETWEEN 1 AND 4));

COMMENT ON COLUMN public.surveys.expected_adult_weight_kg IS
  '예상 성견 체중 (kg). 대형견 puppy 의 Ca:P 상한 룰 발화 — ≥25kg 성견 예상 +
   <18개월 puppy 면 large-breed growth 분기. AAFCO 2024 / NRC 2006 ch.15.
   NULL = 미입력 시 보수적 일반 puppy 처방.';

COMMENT ON COLUMN public.surveys.iris_stage IS
  'IRIS CKD 진단 단계 (1~4). Stage 1-2 = 단백질 정상 + 인 제한, Stage 3+ =
   단백질 제한. NULL = CKD 없음 또는 stage 미진단. IRIS 2019 Guidelines.';

COMMIT;

-- ============================================================================
-- 검증 쿼리
-- ============================================================================
-- 1) 컬럼 추가 확인:
--    SELECT column_name, data_type
--    FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='surveys'
--      AND column_name IN ('expected_adult_weight_kg', 'iris_stage');
--
-- 2) Constraint 동작 — invalid 값 거부:
--    INSERT INTO surveys (..., iris_stage) VALUES (..., 5);  -- CHECK 위반
