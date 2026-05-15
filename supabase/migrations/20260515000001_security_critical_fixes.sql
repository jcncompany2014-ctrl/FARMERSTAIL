-- =============================================================================
-- Security Critical Fixes (audit-110 #61, #62, #63)
-- =============================================================================
--
-- 2026-05-15 광역 감사에서 발견된 보안 Critical 4건 중 3건을 마이그레이션으로.
-- 4번째 (#64 주문취소 환급/회수 reference_id) 는 라우트 코드 수정.
--
-- # 61. apply_point_delta — 임의 p_user_id 인자 차단
-- ----------------------------------------------------
-- 기존: authenticated 권한자가 supabase.rpc('apply_point_delta', { p_user_id: <타인> }) 호출 가능.
--   - 타인 잔액 임의 +N 적립 가능 (음수 -N 은 잔액 부족으로 거부되지만 +는 통과)
--   - p_reference_id 선점으로 정상 적립 차단 (unique_violation silent ok)
-- 수정: 함수 시작부에 auth.uid() 검증. admin 만 타인 user_id 호출 가능.
--      추가로 'admin_adjustment' reference_type 도 admin 전용.
--
-- # 62. submit_photo_request — anon 노출 제거
-- ---------------------------------------------
-- 기존: anon GRANT EXECUTE + p_photo_url 무검증 → 임의 외부 URL (추적 픽셀, javascript:) 주입
-- 수정: anon GRANT 제거. service_role 만. 서버 라우트(/api/photo-upload)는 createAdminClient
--      를 이미 사용 중이라 호환.
--
-- # 63. is_admin() OR fallback 제거 + profiles.role UPDATE 차단
-- ----------------------------------------------------------
-- 기존: is_admin() 이 app_metadata.role='admin' OR profiles.role='admin'.
--      profiles UPDATE 정책에 role 컬럼 변경 차단 트리거 없으면 self-elevation.
-- 수정:
--   (a) is_admin() OR fallback 제거 — app_metadata 만 신뢰
--   (b) profiles role 컬럼 변경 차단 트리거 (defense-in-depth)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- #61. apply_point_delta — auth.uid() 검증 추가
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_point_delta(
  p_user_id        UUID,
  p_delta          INTEGER,
  p_reason         TEXT,
  p_reference_type TEXT,
  p_reference_id   UUID
)
RETURNS TABLE(balance_after INTEGER, ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key  BIGINT;
  v_prev      INTEGER;
  v_next      INTEGER;
  v_caller    UUID;
  v_is_admin  BOOLEAN;
BEGIN
  -- ── 호출자 검증 ──────────────────────────────────────────────────────────
  -- service_role 키로 호출되면 auth.uid() 는 NULL → 모든 user_id 허용.
  -- authenticated 키로 호출되면 auth.uid() = caller 이며, p_user_id 와 일치
  -- 해야 함 (admin 제외).
  v_caller := auth.uid();
  IF v_caller IS NOT NULL THEN
    -- authenticated 호출: 본인 user_id 만 허용. admin 은 타인 허용.
    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = v_caller AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF p_user_id <> v_caller AND NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: cannot modify other user point ledger'
        USING ERRCODE = '42501';
    END IF;

    -- admin_adjustment 는 admin 전용 — 일반 사용자가 임의 reason 으로
    -- 멱등 row 선점 (정상 적립 차단) 못 하게.
    IF p_reference_type = 'admin_adjustment' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: admin_adjustment requires admin role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  -- service_role (v_caller IS NULL) 는 모든 인자 허용 — 서버 코드/webhook 신뢰.

  -- ── 기존 로직 (advisory lock + balance read + insert) ──────────────────
  v_lock_key := hashtext(p_user_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT pl.balance_after INTO v_prev
  FROM public.point_ledger pl
  WHERE pl.user_id = p_user_id
  ORDER BY pl.created_at DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    v_prev := 0;
  END IF;

  v_next := v_prev + p_delta;

  IF v_next < 0 THEN
    RETURN QUERY SELECT v_prev, FALSE, '포인트 잔액이 부족해요'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.point_ledger (
      user_id, delta, balance_after, reason, reference_type, reference_id
    ) VALUES (
      p_user_id, p_delta, v_next, p_reason, p_reference_type, p_reference_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT v_prev, TRUE, 'already_applied'::TEXT;
      RETURN;
  END;

  RETURN QUERY SELECT v_next, TRUE, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.apply_point_delta IS
  'Atomic point ledger with per-user advisory lock + idempotency + auth.uid()/admin enforcement (audit #61).';

-- ─────────────────────────────────────────────────────────────────────────────
-- #62. submit_photo_request — anon GRANT 제거
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.submit_photo_request(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_photo_request(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_photo_request(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.submit_photo_request IS
  'Service-role only — server routes use createAdminClient. anon was a CSRF/XSS injection vector (audit #62).';

-- ─────────────────────────────────────────────────────────────────────────────
-- #63a. is_admin() — profiles.role OR fallback 제거
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data ->> 'role') = 'admin'
  );
$func$;

COMMENT ON FUNCTION public.is_admin IS
  'app_metadata.role only — profiles.role fallback removed to prevent self-elevation (audit #63).';

-- ─────────────────────────────────────────────────────────────────────────────
-- #63b. profiles.role 컬럼 변경 차단 트리거 (defense-in-depth)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- role 컬럼이 실제 변경됐는지 확인.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- service_role 호출은 통과 (auth.uid() IS NULL).
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    -- authenticated 호출자가 admin 인지 확인.
    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: profiles.role can only be changed by admin or service_role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- profiles 테이블 + role 컬럼이 존재할 때만 트리거 생성.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
    CREATE TRIGGER trg_prevent_profile_role_change
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_profile_role_change();

    COMMENT ON TRIGGER trg_prevent_profile_role_change ON public.profiles IS
      'Defense-in-depth: prevent authenticated users from changing their own role (audit #63).';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- 검증 쿼리
-- =============================================================================
-- 1) 일반 사용자가 타인 user_id 로 apply_point_delta 호출 시 거부:
--    (authenticated 컨텍스트에서)
--    SELECT * FROM apply_point_delta('<타인_uuid>', 1000, 'test', 'test', NULL);
--    → ERROR: forbidden: cannot modify other user point ledger
--
-- 2) anon 으로 submit_photo_request 호출 시 거부:
--    (anon key 컨텍스트에서)
--    SELECT submit_photo_request('any-token', 'https://evil.com/x.gif');
--    → ERROR: permission denied for function submit_photo_request
--
-- 3) 일반 사용자가 자기 profiles.role = 'admin' 시도 시 거부:
--    UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
--    → ERROR: forbidden: profiles.role can only be changed by admin or service_role
-- =============================================================================
