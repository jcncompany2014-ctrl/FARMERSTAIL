-- ─────────────────────────────────────────────────────────────────────────────
-- admin_audit_log — admin 액션 추적 (insert-only ledger)
--
-- WHY:
--   payment_events 는 결제 관련 audit. 그 외 admin 액션 (상품 수정, 주문 상태
--   강제 변경, 유저 정지, 가격 조정, 베타 cohort 변경 등) 에 대한 일반 audit
--   log 가 누락. 솔로 운영자라도 6개월 후 "내가 언제 뭐 했더라" 추적 가능
--   해야 하고, 향후 직원/CS 알바 추가 시 누가 어떤 액션 했는지 책임 추적 필수.
--
-- DESIGN:
--   - insert-only — UPDATE / DELETE 금지 (RLS 로 강제)
--   - actor_user_id 는 auth.users 참조 — admin 만 INSERT 가능 (RLS)
--   - diff: 변경 전/후 JSON. 필요한 필드만 추출해서 저장 (전체 row 저장 X)
--   - entity_type / entity_id: 어떤 객체에 대한 액션인지
--
-- CONVENTION:
--   action 명명: <entity>_<verb> 형태
--   예: product_update, order_cancel, user_suspend, price_adjust, cohort_add
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 누가 — admin user (RLS 로 admin 만 INSERT 가능)
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 무엇 — action 종류 (자유 문자열, naming convention: <entity>_<verb>)
  action text NOT NULL CHECK (length(action) BETWEEN 3 AND 80),

  -- 대상 — 어떤 entity 에 대한 액션
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 40),
  entity_id text CHECK (entity_id IS NULL OR length(entity_id) BETWEEN 1 AND 200),

  -- 변경 내용 — { before: {...}, after: {...}, meta: {...} } 형태 권장
  -- 전체 row 저장 X — 변경된 필드만 추출 (PII 최소화).
  diff jsonb,

  -- 컨텍스트
  ip text,
  user_agent text,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- 자주 쓰는 조회 패턴 — actor 별 최근 액션 / entity 별 변경 이력
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created
  ON public.admin_audit_log (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON public.admin_audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log (action, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- INSERT: admin 만 (profile.role = 'admin')
-- SELECT: admin 만
-- UPDATE / DELETE: 전면 금지 (insert-only ledger)

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수 — auth.uid() 가 admin 인지 확인. 다른 admin RLS 와 일관성 유지
-- 위해 profiles.role 또는 admin_users 테이블 둘 다 점검.
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  ) INTO is_admin;
  RETURN COALESCE(is_admin, false);
END $$;

DROP POLICY IF EXISTS admin_audit_log_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_insert ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    public.is_admin_user(auth.uid())
    AND actor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS admin_audit_log_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select ON public.admin_audit_log
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- UPDATE / DELETE 정책 미정의 → RLS 활성화된 테이블은 정책 없으면 거부.
-- service_role 은 RLS 무시하므로 application code 에서 service_role 클라이언트로
-- 호출하면 INSERT 가능 (서버 측 admin 검증 후 호출 필요).

-- ── 코멘트 ────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.admin_audit_log IS
  'Admin 액션 audit log (insert-only). 누가 언제 어떤 액션을 했는지 추적.';

COMMENT ON COLUMN public.admin_audit_log.action IS
  '액션 종류. naming: <entity>_<verb>. 예: product_update, order_cancel, user_suspend';

COMMENT ON COLUMN public.admin_audit_log.diff IS
  '변경 내용. { before: {...}, after: {...}, meta: {...} } 형태 권장. PII 최소화.';
