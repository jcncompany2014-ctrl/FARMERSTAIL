-- ============================================================================
-- Migration: algorithm_food_lines — omega-3 / omega-6 / vitamin D 추가
-- ============================================================================
--
-- 배경 (audit Section 5)
--   · AAFCO 2024 minimum EPA+DHA 0.1% DM (성견)
--   · ACVIM 2019 cardiac (MMVD) — EPA+DHA 40-65 mg/kg BW/day
--   · NRC 2006 omega-6:3 healthy 5:1~10:1, 염증성 atopy/IBD 2:1~5:1
--   · AAFCO 2024 vitamin D minimum 500 IU/kg DM, max 3,000 IU/kg DM (대형
--     puppy 5,000 IU/kg)
--
-- 추가 컬럼 — 배치 lab report 미입력 시에도 default estimate 로 nutrient panel
-- 계산 가능. admin 이 실제 batch 분석 후 override 가능.
--
-- # 추정값 출처 (USDA FoodData Central + NRC 2006 수정)
--   basic   chicken meat (skinless cooked) — EPA+DHA 0.05g, ω-6 1.0g, Vit D 5 IU /100g
--   weight  duck breast (skinless)        — EPA+DHA 0.10g, ω-6 1.0g, Vit D 25 IU /100g
--   skin    salmon (farmed atlantic)      — EPA+DHA 2.0g,  ω-6 0.5g, Vit D 360 IU /100g
--   premium beef (lean trimmed)           — EPA+DHA 0.03g, ω-6 0.5g, Vit D 5 IU /100g
--   joint   pork (loin)                   — EPA+DHA 0.05g, ω-6 1.5g, Vit D 50 IU /100g
--
-- DM% 변환 — 화식 평균 moisture 70% 가정 (FOAS 화식 가이드).
--   wet g/100g → DM% 환산: × (100/30) × (1/100) = / 0.30 × 100% (100g wet 의
--   30g DM 기준).
-- ============================================================================

ALTER TABLE public.algorithm_food_lines
  ADD COLUMN IF NOT EXISTS omega3_pct_dm numeric(4, 2)
    DEFAULT NULL CHECK (omega3_pct_dm IS NULL OR omega3_pct_dm BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS omega6_pct_dm numeric(4, 2)
    DEFAULT NULL CHECK (omega6_pct_dm IS NULL OR omega6_pct_dm BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS vitamin_d_iu_per_100g_dm smallint
    DEFAULT NULL CHECK (vitamin_d_iu_per_100g_dm IS NULL OR vitamin_d_iu_per_100g_dm BETWEEN 0 AND 5000);

-- 추정값 backfill (USDA + 화식 70% moisture). 기존 row 만 update — INSERT
-- ON CONFLICT DO UPDATE 와 동일 효과. admin 이 배치 lab 결과로 override 가능.
UPDATE public.algorithm_food_lines SET omega3_pct_dm = 0.17, omega6_pct_dm = 3.3, vitamin_d_iu_per_100g_dm = 17 WHERE line = 'basic'   AND omega3_pct_dm IS NULL;
UPDATE public.algorithm_food_lines SET omega3_pct_dm = 0.33, omega6_pct_dm = 3.3, vitamin_d_iu_per_100g_dm = 83 WHERE line = 'weight'  AND omega3_pct_dm IS NULL;
UPDATE public.algorithm_food_lines SET omega3_pct_dm = 6.7,  omega6_pct_dm = 1.7, vitamin_d_iu_per_100g_dm = 1200 WHERE line = 'skin'    AND omega3_pct_dm IS NULL;
UPDATE public.algorithm_food_lines SET omega3_pct_dm = 0.10, omega6_pct_dm = 1.7, vitamin_d_iu_per_100g_dm = 17 WHERE line = 'premium' AND omega3_pct_dm IS NULL;
UPDATE public.algorithm_food_lines SET omega3_pct_dm = 0.17, omega6_pct_dm = 5.0, vitamin_d_iu_per_100g_dm = 167 WHERE line = 'joint'   AND omega3_pct_dm IS NULL;

COMMENT ON COLUMN public.algorithm_food_lines.omega3_pct_dm IS
  'EPA+DHA 합산 % DM. AAFCO 2024 성견 최소 0.1% DM. ACVIM cardiac 권장 40-65 mg/kg BW/day. NULL = 추후 batch lab.';
COMMENT ON COLUMN public.algorithm_food_lines.omega6_pct_dm IS
  'omega-6 % DM. NRC 2006 omega-6:3 ratio 5:1~10:1 (healthy), 2:1~5:1 (염증성).';
COMMENT ON COLUMN public.algorithm_food_lines.vitamin_d_iu_per_100g_dm IS
  'vitamin D IU / 100g DM. AAFCO 500-3000 IU/kg DM (대형 puppy 5000 IU/kg max).';
