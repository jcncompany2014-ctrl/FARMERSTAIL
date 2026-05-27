-- ─────────────────────────────────────────────────────────────────────────────
-- admin_audit_log 강화 — R81 코드 review 결과 발견된 2건 보강
--
-- 1. is_admin_user() → is_admin() 표준화
--    이전 migration (20260527000001) 에서 잘못 만든 is_admin_user(uuid) 가
--    profiles.role 만 확인. 표준 public.is_admin() 는 app_metadata.role 만
--    확인 (audit #63 self-elevation 방지). 신규 admin 등록 시 profiles.role
--    동기화 안 되면 audit insert 차단됨 — 실제 admin 의 액션이 추적 안 됨.
--    → RLS policy 가 표준 is_admin() 호출하도록 ALTER.
--
-- 2. INSERT-only ledger 보호 강화
--    UPDATE/DELETE 정책 부재로 RLS 차단되지만, service_role 은 RLS bypass.
--    payment_events 와 동일하게 BEFORE UPDATE/DELETE trigger 로 영구 차단.
--    application 측에서 admin client (service_role) 로 audit row 수정 시도
--    하면 trigger 에서 raise exception.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) RLS 정책 표준화 — is_admin_user(uuid) → is_admin()
DROP POLICY IF EXISTS admin_audit_log_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_insert ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND actor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS admin_audit_log_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select ON public.admin_audit_log
  FOR SELECT
  USING (public.is_admin());

-- 이전 함수는 다른 곳에서 호출 안 됨 — 안전하게 삭제
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);


-- 2) INSERT-only ledger 보호 (payment_events 패턴 미러)
CREATE OR REPLACE FUNCTION public.block_admin_audit_log_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION
    'admin_audit_log is insert-only — % blocked. ledger integrity preserved.',
    TG_OP
    USING ERRCODE = 'check_violation';
END $func$;

DROP TRIGGER IF EXISTS block_admin_audit_log_update ON public.admin_audit_log;
CREATE TRIGGER block_admin_audit_log_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_audit_log_mutations();

DROP TRIGGER IF EXISTS block_admin_audit_log_delete ON public.admin_audit_log;
CREATE TRIGGER block_admin_audit_log_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_audit_log_mutations();

COMMENT ON FUNCTION public.block_admin_audit_log_mutations IS
  'admin_audit_log insert-only 보호. service_role 도 UPDATE/DELETE 차단.';
