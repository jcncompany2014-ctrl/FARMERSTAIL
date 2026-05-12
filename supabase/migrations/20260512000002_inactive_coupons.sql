-- 재참여 (inactive_30d) 쿠폰 시스템.
--
-- 동작
-- ────
-- /api/cron/inactive-coupons 가 매일/매주 실행되어:
--   1) 마지막 로그인이 30일+ 전 사용자 + 마케팅 이메일 동의 사용자
--   2) 이번 달 이미 발송 받은 사용자 제외
--   3) audience_type='inactive_30d' 활성 쿠폰 picking
--   4) 이메일 발송 + log insert
--
-- 멱등성: (user_id, year_month) UNIQUE — 같은 달에 두 번 보내지 않음.
-- birthday 와 같은 패턴이라 운영/이해 동선이 일치.

CREATE TABLE IF NOT EXISTS public.inactive_coupon_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- 'YYYY-MM' (KST 기준)
  coupon_code text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year_month)
);

CREATE INDEX IF NOT EXISTS inactive_coupon_log_sent_idx
  ON public.inactive_coupon_log (sent_at DESC);

-- RLS — 사용자 본인이 자신의 로그 확인은 가능 (재참여 메일 수신 기록 투명성).
-- 운영자(admin)는 service_role 키로 우회. 일반 사용자 INSERT/UPDATE/DELETE 모두 차단.
ALTER TABLE public.inactive_coupon_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inactive_coupon_log_self_select ON public.inactive_coupon_log;
CREATE POLICY inactive_coupon_log_self_select
  ON public.inactive_coupon_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.inactive_coupon_log IS
  '재참여 (inactive_30d) 쿠폰 발송 이력. (user_id, year_month) 멱등 — 한 달 1회.';

-- INACTIVE30 시드 쿠폰 — admin 이 audience_type='inactive_30d' 로 직접 만들어도
-- 되지만 즉시 활성 동작하도록 한 건 미리 생성. ON CONFLICT (code) 로 멱등.
INSERT INTO public.coupons (
  code, name, description,
  discount_type, discount_value,
  min_order_amount, max_discount,
  starts_at, expires_at,
  usage_limit, per_user_limit,
  is_active, audience_type
) VALUES (
  'COMEBACK15',
  '오랜만이에요 쿠폰',
  '30일 이상 활동 없으면 자동 발송되는 15% 할인. /api/cron/inactive-coupons.',
  'percent',
  15,
  30000,
  20000,
  now(),
  now() + interval '1 year',
  null,
  1,
  true,
  'inactive_30d'
)
ON CONFLICT (code) DO NOTHING;
