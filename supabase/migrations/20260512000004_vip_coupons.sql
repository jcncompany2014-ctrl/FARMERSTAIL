-- VIP 등급 쿠폰 (vip_tier audience) — gold/vip 등급 사용자에게 정기 발송.
--
-- 동작
-- ────
-- /api/cron/vip-coupons 가 매월 1일 (또는 운영자 결정 빈도) 실행되어:
--   1) profiles.tier IN ('gold','vip') 사용자
--   2) 마케팅 동의 + 이메일 보유
--   3) 이번 달 이미 발송 받은 사용자 제외
--   4) audience_type='vip_tier' 활성 쿠폰 picking
--   5) 이메일 발송 + log insert
--
-- tier 정의 (fn_compute_tier 참고):
--   bronze : spend <  100,000
--   silver : spend >= 100,000
--   gold   : spend >= 500,000
--   vip    : spend >= 2,000,000

CREATE TABLE IF NOT EXISTS public.vip_coupon_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- 'YYYY-MM' (KST)
  coupon_code text NOT NULL,
  tier text NOT NULL, -- 발송 시점 등급 (변경되어도 기록 유지)
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year_month)
);

CREATE INDEX IF NOT EXISTS vip_coupon_log_sent_idx
  ON public.vip_coupon_log (sent_at DESC);

ALTER TABLE public.vip_coupon_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vip_coupon_log_self_select ON public.vip_coupon_log;
CREATE POLICY vip_coupon_log_self_select
  ON public.vip_coupon_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vip_coupon_log IS
  'VIP/gold 등급 쿠폰 발송 이력. (user_id, year_month) 멱등 — 한 달 1회.';

-- VIP20 시드 쿠폰 — admin 이 자유 변경. 20% 할인 / 5만원 이상 / 1년 유효.
INSERT INTO public.coupons (
  code, name, description,
  discount_type, discount_value,
  min_order_amount, max_discount,
  starts_at, expires_at,
  usage_limit, per_user_limit,
  is_active, audience_type
) VALUES (
  'VIP20',
  'VIP 감사 쿠폰',
  'gold/vip 등급 사용자에게 매월 1회 자동 발송되는 20% 할인. /api/cron/vip-coupons.',
  'percent', 20, 50000, 30000,
  now(), now() + interval '1 year',
  null, 1, true, 'vip_tier'
) ON CONFLICT (code) DO NOTHING;
