-- 수동 발급 쿠폰 (manual audience) — admin 이 사용자 1명씩 지정 발급.
--
-- 동작
-- ────
-- audience_type='manual' 쿠폰은 코드 입력만으로는 사용 불가. admin 이
-- /admin/coupons 에서 "발급" 버튼으로 manual_coupon_grants 에 row 를
-- 넣어줘야 그 사용자만 사용 가능. 사용자 측 redemption 검증은:
--   - audience='all' : 누구나
--   - audience='manual' : (coupon_id, user_id) 가 grants 에 있어야
--   - 기타 ('first_signup','birthday','inactive_30d','vip_tier') : 자동 발급
--     로직이 이메일/배너로 알려줌
--
-- 표준 ON CONFLICT 로 같은 사용자에게 두 번 발급 시도 시 silent skip.

CREATE TABLE IF NOT EXISTS public.manual_coupon_grants (
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),    -- 발급한 admin
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS manual_coupon_grants_user_idx
  ON public.manual_coupon_grants (user_id);

CREATE INDEX IF NOT EXISTS manual_coupon_grants_granted_at_idx
  ON public.manual_coupon_grants (granted_at DESC);

ALTER TABLE public.manual_coupon_grants ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신에게 발급된 grant 만 select. INSERT/UPDATE/DELETE 는 admin
-- (service_role) 만 — RLS 로 차단되어 일반 사용자는 자기 grant 도 생성 불가.
DROP POLICY IF EXISTS manual_coupon_grants_self_select ON public.manual_coupon_grants;
CREATE POLICY manual_coupon_grants_self_select
  ON public.manual_coupon_grants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.manual_coupon_grants IS
  'audience=manual 쿠폰의 user 별 발급 기록. (coupon_id, user_id) UNIQUE.';
