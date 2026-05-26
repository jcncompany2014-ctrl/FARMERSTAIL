-- XL-6 (#48) — 가족 권한 모델 정밀화: RLS 확장.
--
-- # 배경
-- 20260513000002 에서 dog_members 테이블 + has_dog_access(dog_id) helper
-- 정의했지만, 정작 weight_logs / dog_medications / dog_vaccinations /
-- dog_expenses / dog_checkins 의 RLS 가 owner only 그대로. 가족 멤버가
-- 강아지 상세에 진입해도 데이터가 안 보이는 상태.
--
-- 이 마이그레이션은 (A) role-aware helper 추가, (B) 공동 케어 가능
-- 테이블의 RLS 확장.
--
-- # 권한 모델
--   owner  : dogs.user_id 본인. 모든 권한.
--   member : 일지 / 체중 / 약물 / 백신 / 지출 read + write.
--            결제·구독·삭제·소유권 위임은 X.
--   viewer : 모든 데이터 read only.
--
-- # RLS 정책 패턴
--   SELECT : has_dog_access (모든 role 통과)
--   INSERT / UPDATE : has_dog_role >= 'member'
--   DELETE : owner only (dog.user_id)

-- =============================================================================
-- 1) has_dog_role(p_dog_id, p_min_role) — role enum 기반 권한 검사
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_dog_role(p_dog_id uuid, p_min_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_role text;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  -- owner check
  IF EXISTS (
    SELECT 1 FROM public.dogs d
    WHERE d.id = p_dog_id AND d.user_id = v_uid
  ) THEN
    v_my_role := 'owner';
  ELSE
    SELECT role INTO v_my_role
    FROM public.dog_members
    WHERE dog_id = p_dog_id AND user_id = v_uid
    LIMIT 1;
  END IF;

  IF v_my_role IS NULL THEN RETURN FALSE; END IF;

  -- role hierarchy — owner > member > viewer
  CASE p_min_role
    WHEN 'viewer' THEN
      RETURN v_my_role IN ('owner', 'member', 'viewer');
    WHEN 'member' THEN
      RETURN v_my_role IN ('owner', 'member');
    WHEN 'owner' THEN
      RETURN v_my_role = 'owner';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_dog_role(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.has_dog_role(uuid, text) IS
  '강아지에 대해 최소 역할 (owner/member/viewer) 권한 충족 여부. RLS WITH CHECK 에서 사용.';

-- =============================================================================
-- 2) weight_logs RLS 확장
-- =============================================================================

DROP POLICY IF EXISTS "weight_logs_select" ON public.weight_logs;
CREATE POLICY "weight_logs_select" ON public.weight_logs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_dog_access(dog_id)
  );

DROP POLICY IF EXISTS "weight_logs_insert_member" ON public.weight_logs;
CREATE POLICY "weight_logs_insert_member" ON public.weight_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_dog_role(dog_id, 'member')
  );

DROP POLICY IF EXISTS "weight_logs_update_member" ON public.weight_logs;
CREATE POLICY "weight_logs_update_member" ON public.weight_logs
  FOR UPDATE
  USING (public.has_dog_role(dog_id, 'member'))
  WITH CHECK (public.has_dog_role(dog_id, 'member'));

-- DELETE: owner only (자신이 기록한 row 도 owner 동의 필요)
DROP POLICY IF EXISTS "weight_logs_delete_owner" ON public.weight_logs;
CREATE POLICY "weight_logs_delete_owner" ON public.weight_logs
  FOR DELETE
  USING (public.has_dog_role(dog_id, 'owner'));

-- =============================================================================
-- 3) dog_medications RLS 확장
-- =============================================================================

DROP POLICY IF EXISTS "dog_medications_select_own" ON public.dog_medications;
DROP POLICY IF EXISTS "dog_medications_insert_own" ON public.dog_medications;
DROP POLICY IF EXISTS "dog_medications_update_own" ON public.dog_medications;
DROP POLICY IF EXISTS "dog_medications_delete_own" ON public.dog_medications;

CREATE POLICY "dog_medications_select" ON public.dog_medications
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_dog_access(dog_id));

CREATE POLICY "dog_medications_insert_member" ON public.dog_medications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_dog_role(dog_id, 'member'));

CREATE POLICY "dog_medications_update_member" ON public.dog_medications
  FOR UPDATE
  USING (public.has_dog_role(dog_id, 'member'))
  WITH CHECK (public.has_dog_role(dog_id, 'member'));

CREATE POLICY "dog_medications_delete_owner" ON public.dog_medications
  FOR DELETE
  USING (public.has_dog_role(dog_id, 'owner'));

-- =============================================================================
-- 4) dog_vaccinations RLS 확장
-- =============================================================================

DROP POLICY IF EXISTS "dog_vaccinations_select_own" ON public.dog_vaccinations;
DROP POLICY IF EXISTS "dog_vaccinations_insert_own" ON public.dog_vaccinations;
DROP POLICY IF EXISTS "dog_vaccinations_update_own" ON public.dog_vaccinations;
DROP POLICY IF EXISTS "dog_vaccinations_delete_own" ON public.dog_vaccinations;

CREATE POLICY "dog_vaccinations_select" ON public.dog_vaccinations
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_dog_access(dog_id));

CREATE POLICY "dog_vaccinations_insert_member" ON public.dog_vaccinations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_dog_role(dog_id, 'member'));

CREATE POLICY "dog_vaccinations_update_member" ON public.dog_vaccinations
  FOR UPDATE
  USING (public.has_dog_role(dog_id, 'member'))
  WITH CHECK (public.has_dog_role(dog_id, 'member'));

CREATE POLICY "dog_vaccinations_delete_owner" ON public.dog_vaccinations
  FOR DELETE
  USING (public.has_dog_role(dog_id, 'owner'));

-- =============================================================================
-- 5) dog_expenses RLS 확장
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='dog_expenses') THEN
    EXECUTE 'DROP POLICY IF EXISTS "dog_expenses_select_own" ON public.dog_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "dog_expenses_insert_own" ON public.dog_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "dog_expenses_update_own" ON public.dog_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "dog_expenses_delete_own" ON public.dog_expenses';

    EXECUTE 'CREATE POLICY "dog_expenses_select" ON public.dog_expenses
      FOR SELECT
      USING (auth.uid() = user_id OR public.has_dog_access(dog_id))';
    EXECUTE 'CREATE POLICY "dog_expenses_insert_member" ON public.dog_expenses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_dog_role(dog_id, ''member''))';
    EXECUTE 'CREATE POLICY "dog_expenses_update_member" ON public.dog_expenses
      FOR UPDATE
      USING (public.has_dog_role(dog_id, ''member''))
      WITH CHECK (public.has_dog_role(dog_id, ''member''))';
    EXECUTE 'CREATE POLICY "dog_expenses_delete_owner" ON public.dog_expenses
      FOR DELETE
      USING (public.has_dog_role(dog_id, ''owner''))';
  END IF;
END $$;

-- =============================================================================
-- 6) surveys + analyses — SELECT 만 확장 (member 가 작성하는 흐름은 없음)
-- =============================================================================

DO $$
BEGIN
  -- surveys
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='surveys' AND policyname='surveys_member_select') THEN
    EXECUTE 'DROP POLICY "surveys_member_select" ON public.surveys';
  END IF;
  EXECUTE 'CREATE POLICY "surveys_member_select" ON public.surveys
    FOR SELECT
    USING (public.has_dog_access(dog_id))';

  -- analyses
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analyses' AND policyname='analyses_member_select') THEN
    EXECUTE 'DROP POLICY "analyses_member_select" ON public.analyses';
  END IF;
  EXECUTE 'CREATE POLICY "analyses_member_select" ON public.analyses
    FOR SELECT
    USING (public.has_dog_access(dog_id))';
END $$;
