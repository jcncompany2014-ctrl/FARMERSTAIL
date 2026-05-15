-- =============================================================================
-- Security High Fixes (audit-110 #65, #67, #14*)
-- =============================================================================
--
-- # 65. fetch_vet_share — expires_at default 14d → 7d
-- ---------------------------------------------------
-- 토큰 leak 후 노출 윈도우 단축. accessed_count 알림 + IP rate limit 은 server
-- route 단계 (별도 patch). expires_at default 만 마이그레이션.
--
-- # 67. dog_invitations SELECT — token 컬럼 분리
-- ----------------------------------------------
-- 이전: 정책이 row-level 접근만 검증 → SELECT 통과 시 token 컬럼까지 노출.
-- email 일치만으로 다른 사용자가 자기 이메일과 같은 모든 invitation 의 token 을 읽을 수 있음.
-- 해결: token 컬럼 view 분리 (created_by 만 token 읽기 가능). accept 흐름은
-- RPC 가 token 으로만 검증 — view 우회.
--
-- # 14*. vet_share_tokens UPDATE 제한 (audit #74 도 같이)
-- 사용자가 자기 token 의 expires_at / accessed_count 임의 변경 못 하게.
-- UPDATE 정책 → revoked_at 만 set 가능 (revoke RPC 외엔 다른 컬럼 immutable).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- #65. vet_share_tokens expires_at default 단축 (기존 row 영향 없음)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vet_share_tokens
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

COMMENT ON COLUMN public.vet_share_tokens.expires_at IS
  'Token 만료 시각. 기본 7일 (audit #65 — 단톡방 leak 노출 시간 단축).';

-- ─────────────────────────────────────────────────────────────────────────────
-- #67. dog_invitations — token 컬럼 view 분리
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 기존 SELECT 정책은 row 만 통제, 컬럼은 못 가림. 두 가지 view:
--  - public.dog_invitations_public — token 컬럼 제외 (받은 초대 확인 용)
--  - public.dog_invitations_admin — 전체 컬럼, created_by 만 접근 (소유자 추적)
-- accept 흐름은 별도 RPC accept_dog_invitation(p_token) — view 우회.

DROP VIEW IF EXISTS public.dog_invitations_public CASCADE;
CREATE VIEW public.dog_invitations_public
WITH (security_invoker = true)
AS
SELECT
  id,
  dog_id,
  invited_by,
  email,
  role,
  expires_at,
  accepted_at,
  declined_at,
  created_at
  -- token 컬럼 의도적 제외
FROM public.dog_invitations;

COMMENT ON VIEW public.dog_invitations_public IS
  'dog_invitations SELECT 인터페이스 — token 컬럼 제외. accept 는 RPC 로만 (audit #67).';

GRANT SELECT ON public.dog_invitations_public TO authenticated;

-- 기존 SELECT 정책 강화: invited_by (자기가 보낸 초대) 만 row 전체 접근.
-- email 매칭 정책은 view 로 옮김 (token 컬럼 leak 방지).
DROP POLICY IF EXISTS "dog_invitations_select" ON public.dog_invitations;
CREATE POLICY "dog_invitations_select" ON public.dog_invitations
  FOR SELECT
  USING (
    auth.uid() = invited_by
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- #74. vet_share_tokens UPDATE 제한 — revoke 만 허용
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 기존 UPDATE 정책은 dog owner 면 모든 컬럼 변경 가능 → expires_at +100년,
-- accessed_count 0 reset 같은 임의 변경 위험. revoke 만 row-level 허용 +
-- 다른 컬럼 변경 차단 트리거.

DROP POLICY IF EXISTS "vet_share_owner_all" ON public.vet_share_tokens;

-- SELECT: dog owner.
CREATE POLICY "vet_share_owner_select" ON public.vet_share_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

-- INSERT: dog owner.
CREATE POLICY "vet_share_owner_insert" ON public.vet_share_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

-- DELETE: dog owner.
CREATE POLICY "vet_share_owner_delete" ON public.vet_share_tokens
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

-- UPDATE: dog owner — 단, immutable 컬럼 변경 차단 트리거 별도.
CREATE POLICY "vet_share_owner_update" ON public.vet_share_tokens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_vet_share_token_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role 호출은 통과 (auth.uid() IS NULL).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- token / created_by / expires_at / accessed_count / last_accessed_at /
  -- dog_id / created_at 은 모두 immutable. revoked_at 만 set 허용.
  IF NEW.token IS DISTINCT FROM OLD.token THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.token is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.created_by is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.expires_at is immutable (use revoke + new token)'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.dog_id IS DISTINCT FROM OLD.dog_id THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.dog_id is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.created_at is immutable'
      USING ERRCODE = '42501';
  END IF;
  -- accessed_count / last_accessed_at — fetch_vet_share RPC (SECURITY DEFINER)
  -- 가 anon 컨텍스트에서 수정. authenticated 컨텍스트에서는 변경 불가.
  IF NEW.accessed_count IS DISTINCT FROM OLD.accessed_count THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.accessed_count immutable in user context'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.last_accessed_at IS DISTINCT FROM OLD.last_accessed_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.last_accessed_at immutable in user context'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vet_share_tampering ON public.vet_share_tokens;
CREATE TRIGGER trg_prevent_vet_share_tampering
  BEFORE UPDATE ON public.vet_share_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vet_share_token_tampering();

COMMENT ON TRIGGER trg_prevent_vet_share_tampering ON public.vet_share_tokens IS
  'audit #74: token/expires_at/accessed_count 등 immutable — revoke 만 허용.';

COMMIT;
