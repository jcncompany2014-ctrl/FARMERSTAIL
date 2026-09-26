-- ─────────────────────────────────────────────────────────────────────────────
-- 진행 중인 이벤트 코드를 비로그인 목록 조회로 받아 가지 못하게 (2026-09-26 출시 전 점검 7차)
--
-- promotions_read_open 은 역할 제한 없이 "활성 기간인 행"을 누구에게나 보여 줬다. 웹 번들의 공개
-- anon 키로 GET /rest/v1/promotions?select=code,discount_rate,max_signups 하면 오프라인 QR·인스타
-- 전용 코드가 그대로 나와, 핫딜 커뮤니티 등에서 선착순 자리(max_signups)를 먼저 차지할 수 있었다.
--
-- 이 정책을 쓰는 화면은 없다(grep): 어드민은 service_role, 가입 시 적용은 claim_promotion,
-- 청구 할인은 pending_promotion_rate — 둘 다 SECURITY DEFINER 라 RLS 와 무관하다.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists promotions_read_open on public.promotions;

drop policy if exists promotions_read_admin on public.promotions;
create policy promotions_read_admin on public.promotions
  for select
  using (public.is_admin());
