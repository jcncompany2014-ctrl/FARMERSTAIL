-- 쿠폰 만료 임박 알림 추적.
--
-- # 목적
-- /api/cron/coupon-expiry 가 D-3 만료 임박 쿠폰을 사용자에게 1회 알림.
-- 같은 (사용자, 쿠폰) 페어에 중복 발송 방지하기 위한 ledger.
--
-- # 멱등
-- UNIQUE (user_id, coupon_id) — INSERT ... ON CONFLICT DO NOTHING 패턴.

CREATE TABLE IF NOT EXISTS public.coupon_expiry_notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_expiry_unique UNIQUE (user_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS coupon_expiry_notifications_user_idx
  ON public.coupon_expiry_notifications (user_id, notified_at DESC);

-- RLS — admin 만 read (사용자에겐 노출 가치 없음). insert 는 service_role.
ALTER TABLE public.coupon_expiry_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupon_expiry_admin_select"
  ON public.coupon_expiry_notifications;
CREATE POLICY "coupon_expiry_admin_select"
  ON public.coupon_expiry_notifications
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.coupon_expiry_notifications IS
  '쿠폰 만료 D-3 알림 발송 추적. (user_id, coupon_id) UNIQUE — 중복 발송 차단.';
