-- ============================================================================
-- Migration: RLS UPDATE with_check + storage 버킷 제약 보강 (audit v3)
-- ============================================================================
--
-- # 문제 1 — RLS UPDATE with_check 누락
--  qual (USING) 만 있고 with_check 가 없으면 사용자가 자기 row UPDATE 하면서
--  user_id 를 다른 uuid 로 변경 가능. SELECT 도 user_id 매칭이라 직후 row
--  소유권 잃지만 데이터 무결성 / 감사 측면에서 차단해야 함.
--
-- # 문제 2 — 일부 storage 버킷에 file_size_limit / mime 제약 없음
--  blog-covers / event-images / review-photos 가 무제한 + mime 무관 → 비용
--  + 보안 (PDF / video 업로드 가능). 5MB + image/* 만 허용.
-- ============================================================================

-- ── RLS UPDATE with_check 보강 ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own dogs" ON public.dogs;
CREATE POLICY "Users can update own dogs" ON public.dogs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_formulas_self_update ON public.dog_formulas;
CREATE POLICY dog_formulas_self_update ON public.dog_formulas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_checkins_self_update ON public.dog_checkins;
CREATE POLICY dog_checkins_self_update ON public.dog_checkins
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS subs_update_own_or_admin ON public.subscriptions;
CREATE POLICY subs_update_own_or_admin ON public.subscriptions
  FOR UPDATE
  USING ((auth.uid() = user_id) OR is_admin())
  WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- ── Storage 버킷 제약 보강 ────────────────────────────────────────────
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE name IN ('blog-covers','event-images','review-photos')
  AND (file_size_limit IS NULL OR allowed_mime_types IS NULL);
