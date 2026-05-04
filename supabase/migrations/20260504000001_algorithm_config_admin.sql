-- ============================================================================
-- Migration: algorithm_food_lines + algorithm_chronic_severity (admin GUI)
-- ============================================================================
--
-- 배경
-- ----
-- v1.3 까지 알고리즘의 모든 데이터 (라인 영양 단면, 만성질환 강도) 가 TS
-- hardcoded. batch 별 영양 분석 결과가 바뀌어도 코드 push 필요 → 솔로 운영
-- 부담. 이 마이그레이션은 두 표를 DB 로 옮기고 admin UI 가 GUI 로 편집할 수
-- 있게 함. lines.ts 의 hardcoded 값은 fallback 으로 유지 — DB row 가 없으면
-- 그대로 동작 (zero-downtime).
--
-- 두 표
--   1. algorithm_food_lines      — 5종 라인의 kcal / protein / fat / Ca / P / Na
--   2. algorithm_chronic_severity — 만성질환별 default 진단 강도 + factor
--
-- RLS — admin 만 write, authenticated 모두 read (compute API / cron 이 호출).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.algorithm_food_lines (
  line text PRIMARY KEY CHECK (line IN ('basic', 'weight', 'skin', 'premium', 'joint')),
  kcal_per_100g smallint NOT NULL CHECK (kcal_per_100g BETWEEN 50 AND 500),
  protein_pct_dm numeric(4, 1) NOT NULL CHECK (protein_pct_dm BETWEEN 5 AND 60),
  fat_pct_dm numeric(4, 1) NOT NULL CHECK (fat_pct_dm BETWEEN 2 AND 40),
  calcium_pct_dm numeric(4, 2) DEFAULT NULL CHECK (calcium_pct_dm IS NULL OR calcium_pct_dm BETWEEN 0.1 AND 5),
  phosphorus_pct_dm numeric(4, 2) DEFAULT NULL CHECK (phosphorus_pct_dm IS NULL OR phosphorus_pct_dm BETWEEN 0.1 AND 4),
  sodium_pct_dm numeric(4, 3) DEFAULT NULL CHECK (sodium_pct_dm IS NULL OR sodium_pct_dm BETWEEN 0.01 AND 2),
  subtitle_override text DEFAULT NULL,
  benefit_override text DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.algorithm_food_lines
  (line, kcal_per_100g, protein_pct_dm, fat_pct_dm, calcium_pct_dm, phosphorus_pct_dm, sodium_pct_dm)
VALUES
  ('basic',   215, 26, 12, 1.0, 0.8, 0.30),
  ('weight',  175, 28,  8, 1.1, 0.9, 0.25),
  ('skin',    225, 26, 16, 1.0, 0.8, 0.35),
  ('premium', 195, 30, 15, 1.0, 0.8, 0.30),
  ('joint',   200, 24, 18, 1.4, 1.0, 0.40)
ON CONFLICT (line) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.algorithm_chronic_severity (
  condition text PRIMARY KEY,
  korean_label text NOT NULL,
  default_severity text NOT NULL CHECK (default_severity IN ('mild', 'moderate', 'severe')),
  protein_factor numeric(3, 2) NOT NULL DEFAULT 1.0 CHECK (protein_factor BETWEEN 0.3 AND 2.0),
  fat_factor numeric(3, 2) NOT NULL DEFAULT 1.0 CHECK (fat_factor BETWEEN 0.3 AND 2.0),
  notes text DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.algorithm_chronic_severity (condition, korean_label, default_severity, protein_factor, fat_factor, notes) VALUES
  ('kidney',           '만성 신장질환',     'moderate', 0.85, 1.0, 'IRIS staging 입력 시 자동 분기'),
  ('pancreatitis',     '췌장염',           'moderate', 1.0,  0.5, '급성 vs 만성 구분 — 급성은 severe'),
  ('arthritis',        '관절염',           'mild',     1.0,  1.0, 'Grade 1-4 (OFA) 활용'),
  ('allergy_skin',     '알레르기성 피부염', 'mild',     1.0,  1.05, 'severe = 만성 atopy'),
  ('ibd',              '염증성 장질환',     'moderate', 1.0,  0.9, 'CIBDAI score 활용 가능'),
  ('cardiac',          '심장병/DCM',       'moderate', 1.0,  0.95, 'ACVIM stage A-D'),
  ('diabetes',         '당뇨',             'moderate', 1.05, 0.95, '인슐린 의존 vs 비의존'),
  ('liver',            '간질환',           'moderate', 0.9,  0.9,  '간성 뇌증 동반 시 severe'),
  ('cognitive_decline','인지저하증 (CDS)', 'moderate', 1.0,  1.05, 'CCDR/CADES'),
  ('long_term_steroid','장기 스테로이드',  'mild',     1.05, 0.95, 'prednisolone 용량 의존'),
  ('epilepsy',         '간질',             'mild',     1.0,  1.1,  'ketogenic 적응'),
  ('urinary_stone',    '요결석',           'mild',     0.95, 1.0,  'struvite/oxalate 분기'),
  ('dental',           '치주질환',         'mild',     1.0,  1.0,  '경증 표시만')
ON CONFLICT (condition) DO NOTHING;

ALTER TABLE public.algorithm_food_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_chronic_severity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS algorithm_food_lines_admin_all ON public.algorithm_food_lines;
CREATE POLICY algorithm_food_lines_admin_all ON public.algorithm_food_lines
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS algorithm_food_lines_authenticated_read ON public.algorithm_food_lines;
CREATE POLICY algorithm_food_lines_authenticated_read ON public.algorithm_food_lines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS algorithm_chronic_severity_admin_all ON public.algorithm_chronic_severity;
CREATE POLICY algorithm_chronic_severity_admin_all ON public.algorithm_chronic_severity
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS algorithm_chronic_severity_authenticated_read ON public.algorithm_chronic_severity;
CREATE POLICY algorithm_chronic_severity_authenticated_read ON public.algorithm_chronic_severity
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS algorithm_food_lines_updated ON public.algorithm_food_lines;
CREATE TRIGGER algorithm_food_lines_updated
  BEFORE UPDATE ON public.algorithm_food_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS algorithm_chronic_severity_updated ON public.algorithm_chronic_severity;
CREATE TRIGGER algorithm_chronic_severity_updated
  BEFORE UPDATE ON public.algorithm_chronic_severity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
