-- 2026-09-01 출시 전 전수 감사 — 어드민 환불·결제실패 화면이 영구히 "0건"이었다.
--
-- refunds 와 subscription_charges 에는 `*_select_own` 정책 하나뿐이라
-- **관리자도 자기 행만** 본다. 그런데 이 화면들은 service_role 이 아니라 세션
-- 클라이언트로 조회한다(app/admin/refunds/page.tsx:37,
-- app/admin/subscriptions/charges/page.tsx:70, app/admin/page.tsx:83 —
-- 전부 `createClient()`). 그래서 RLS 에 그대로 걸린다.
--
-- 결과: 환불 목록이 항상 비어 있고, 결제 성공률은 실패 행이 안 보여 **항상 100%**로
-- 계산된다. 지표가 초록인데 아무것도 안 보이는 상태였다.
--
-- 다른 어드민 전용 표와 같은 패턴을 쓴다 — `for select using (is_admin())`,
-- roles={public}(cf. account_deletions_admin_select · automation_settings_admin_read).
-- is_admin() 은 app_metadata 만 보고 fail-closed 다(lib/auth/admin 규칙).

create policy "refunds_admin_select"
  on public.refunds
  for select
  using (public.is_admin());

create policy "subscription_charges_admin_select"
  on public.subscription_charges
  for select
  using (public.is_admin());
