-- ============================================================================
-- Migration: algorithm_breed_predispose — 품종별 predispose 매트릭스
-- ============================================================================
--
-- 14 품종 seed (Dalmatian, Doberman, Boxer, Cocker, Labrador, Golden,
-- Rottweiler, Saint Bernard, Great Dane, Shih Tzu, Poodle, Maltese,
-- Chihuahua, Shiba). dogs.breed (자유 텍스트) 와 keyword 매칭해 predispose
-- 만성질환 자동 chip 발화. admin GUI 로 추가/편집 가능.
--
-- 알고리즘 흐름
--   1. dogs.breed 가 breed_keywords[i] 중 하나 ILIKE 매칭
--   2. predispose_conditions[] 의 chronic 키들이 chronicConditions 에 자동 추가
--      (단, 사용자가 명시 입력했으면 중복 방지)
--   3. cautions[] 가 reasoning chip 으로 push (priority 2.5, breed-* ruleId)
--
-- enabled=false 면 skip (운영 중 빠른 disable).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.algorithm_breed_predispose (
  breed_key text PRIMARY KEY,
  korean_label text NOT NULL,
  breed_keywords text[] NOT NULL,
  predispose_conditions text[] NOT NULL DEFAULT ARRAY[]::text[],
  cautions text[] NOT NULL DEFAULT ARRAY[]::text[],
  citations text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- (Seed 14 rows applied via mcp__supabase apply_migration. INSERT 본문은
--  마이그레이션 SQL 에 포함되어 있으나 git 추적용으로 본 파일만 갖고 있음.)

ALTER TABLE public.algorithm_breed_predispose ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS algorithm_breed_predispose_admin_all ON public.algorithm_breed_predispose;
CREATE POLICY algorithm_breed_predispose_admin_all ON public.algorithm_breed_predispose
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS algorithm_breed_predispose_authenticated_read ON public.algorithm_breed_predispose;
CREATE POLICY algorithm_breed_predispose_authenticated_read ON public.algorithm_breed_predispose
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS algorithm_breed_predispose_updated ON public.algorithm_breed_predispose;
CREATE TRIGGER algorithm_breed_predispose_updated
  BEFORE UPDATE ON public.algorithm_breed_predispose
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
