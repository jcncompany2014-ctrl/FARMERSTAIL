-- =============================================================================
-- 가족 다중 계정 — dog_members + dog_invitations
-- =============================================================================
--
-- # 배경
-- 같은 강아지를 여러 사람이 (예: 부부, 부모-자식, 룸메이트) 공동 케어하는
-- 경우가 흔한데 현재 dogs.user_id 가 단일 owner 라 가족 일원이 일지에
-- 접근 못 한다. dog_members 로 공동 케어자를 등록 → RLS 확장으로 데이터
-- 접근 허용.
--
-- # 디자인 결정
-- (A) dogs.user_id 는 owner 로 유지. dog_members 는 "추가 멤버" 만 저장.
--     owner 권한 위임은 별도 RPC (transfer_dog_ownership) 로 처리 — 이번
--     마이그레이션 범위 X.
-- (B) 역할 = owner / member / viewer.
--      - owner : dogs.user_id 본인. row 도 자동으로 dog_members 에 안 들어감
--                (옵션 — 일관성 위해 들어가도 무방하지만 중복 row 회피).
--      - member: 일지 / 체크인 작성 가능. 결제·구독 변경은 X.
--      - viewer: 조회만.
-- (C) 초대 흐름은 dog_invitations (token 기반 magic link) 별도 테이블.
--     초대 수락 시 (1) dog_members row 추가, (2) accepted_at set.
-- (D) RLS 확장 (dogs / analyses / weight_logs 등) 은 별도 마이그레이션에서
--     처리 — 이 파일은 테이블 + 자체 RLS 만 (작은 변경).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) dog_members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dog_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 역할 — owner 는 별도 dogs.user_id 로 표현. 멤버 row 는 member/viewer 만.
  role text NOT NULL CHECK (role IN ('member', 'viewer')) DEFAULT 'member',
  -- 누가 초대했나 (감사 / "○○님이 초대" 표시)
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 같은 (dog, user) 쌍은 1건 — 중복 추가 방지
  UNIQUE (dog_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dog_members_user
  ON public.dog_members (user_id);
CREATE INDEX IF NOT EXISTS idx_dog_members_dog
  ON public.dog_members (dog_id);

ALTER TABLE public.dog_members ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 row, 또는 같은 dog 의 owner (다른 멤버 목록 조회)
DROP POLICY IF EXISTS "dog_members_select" ON public.dog_members;
CREATE POLICY "dog_members_select" ON public.dog_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = dog_members.dog_id
        AND d.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: dog owner 만 (직접 RPC accept 흐름은 SECURITY DEFINER)
DROP POLICY IF EXISTS "dog_members_owner_write" ON public.dog_members;
CREATE POLICY "dog_members_owner_write" ON public.dog_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = dog_members.dog_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = dog_members.dog_id
        AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.dog_members IS
  '강아지 공동 케어자. dogs.user_id 는 owner. 이 테이블은 추가 member/viewer 만.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) dog_invitations — 초대 토큰 (magic link)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dog_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 초대 받는 사람 이메일 (현재 auth.users.email 와 매칭해 accept 시 검증)
  email text NOT NULL CHECK (length(email) <= 254),
  -- magic link 토큰 — 클라이언트 url 에 노출되므로 짧고 unique
  token text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('member', 'viewer')) DEFAULT 'member',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  -- 거절도 별도 기록 — 같은 초대 중복 발송 방지 및 감사
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_invitations_dog
  ON public.dog_invitations (dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_invitations_email
  ON public.dog_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_dog_invitations_token
  ON public.dog_invitations (token);
-- pending 초대만 빠르게 보는 partial index (다음 cron / accept 페이지)
CREATE INDEX IF NOT EXISTS idx_dog_invitations_pending
  ON public.dog_invitations (dog_id)
  WHERE accepted_at IS NULL AND declined_at IS NULL;

ALTER TABLE public.dog_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT:
--  (a) invited_by 본인 (자기가 보낸 초대 추적)
--  (b) email 이 본인 email 매칭 (받은 초대 확인) — auth.email() 비교
DROP POLICY IF EXISTS "dog_invitations_select" ON public.dog_invitations;
CREATE POLICY "dog_invitations_select" ON public.dog_invitations
  FOR SELECT
  USING (
    auth.uid() = invited_by
    OR lower(email) = lower(coalesce(auth.email(), ''))
  );

-- INSERT/UPDATE/DELETE: dog owner 만 (보낼 사람)
DROP POLICY IF EXISTS "dog_invitations_owner_write" ON public.dog_invitations;
CREATE POLICY "dog_invitations_owner_write" ON public.dog_invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = dog_invitations.dog_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = dog_invitations.dog_id
        AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.dog_invitations IS
  '강아지 가족 초대. token magic link + email 매칭으로 accept.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) helper function — has_dog_access(p_dog_id)
-- ─────────────────────────────────────────────────────────────────────────────
-- 추후 dogs / analyses / weight_logs 등의 RLS 확장에서 재사용. SECURITY
-- DEFINER 로 정의해 RLS 재귀 무한 방지.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_dog_access(p_dog_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  -- owner
  IF EXISTS (
    SELECT 1 FROM public.dogs d
    WHERE d.id = p_dog_id AND d.user_id = v_uid
  ) THEN
    RETURN TRUE;
  END IF;
  -- member / viewer
  IF EXISTS (
    SELECT 1 FROM public.dog_members m
    WHERE m.dog_id = p_dog_id AND m.user_id = v_uid
  ) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.has_dog_access(uuid) IS
  '현재 auth.uid() 가 해당 강아지에 owner/member/viewer 접근 권한이 있는지 검사. RLS USING() 절에서 EXISTS 대신 호출 가능.';

GRANT EXECUTE ON FUNCTION public.has_dog_access(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) accept_dog_invitation RPC — token 검증 + dog_members 추가 atomic
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_dog_invitation(p_token text)
RETURNS TABLE(ok boolean, dog_id uuid, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v_inv RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, '로그인이 필요해요'::text;
    RETURN;
  END IF;

  SELECT * INTO v_inv
  FROM public.dog_invitations
  WHERE token = p_token
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, '유효하지 않은 초대 링크예요'::text;
    RETURN;
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_inv.dog_id, '이미 수락된 초대예요'::text;
    RETURN;
  END IF;
  IF v_inv.declined_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_inv.dog_id, '거절된 초대예요'::text;
    RETURN;
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, v_inv.dog_id, '만료된 초대예요'::text;
    RETURN;
  END IF;
  IF lower(v_inv.email) <> v_email THEN
    RETURN QUERY SELECT FALSE, v_inv.dog_id,
      '초대 받은 이메일과 로그인 이메일이 달라요'::text;
    RETURN;
  END IF;

  -- 멤버 추가 + 초대 accepted 마킹 (멱등 — 이미 있으면 ON CONFLICT do nothing)
  INSERT INTO public.dog_members (dog_id, user_id, role, invited_by)
  VALUES (v_inv.dog_id, v_uid, v_inv.role, v_inv.invited_by)
  ON CONFLICT (dog_id, user_id) DO NOTHING;

  UPDATE public.dog_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id AND accepted_at IS NULL;

  RETURN QUERY SELECT TRUE, v_inv.dog_id, '초대를 수락했어요'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_dog_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_dog_invitation(text) IS
  '초대 토큰 검증 + dog_members 추가 atomic. SECURITY DEFINER 로 RLS 우회.';
