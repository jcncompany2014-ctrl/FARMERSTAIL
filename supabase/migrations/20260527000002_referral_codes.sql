-- ─────────────────────────────────────────────────────────────────────────────
-- Referral 시스템 보강 — 피초대자 환영 쿠폰
--
-- WHY:
--   기존 referral 시스템 (referral_codes / referral_redemptions / milestone 보상)
--   은 R-사이클 이전에 구축됨 — 초대자에게 즉시 5,000P, 5/10/20명 milestone 보상.
--   누락된 항목: **피초대자** (referee) 가 받는 보상 — 가입 직후 5,000원 쿠폰.
--   이 migration 은 그 쿠폰 시드만 추가. application 측에선 redeem_referral_code
--   RPC 호출 직후 manual_coupon_grants 에 INSERT.
--
-- 참고:
--   - 기존 referral_codes / referral_redemptions 스키마는 유지 (referrer_id /
--     referee_id 컬럼명)
--   - milestone 보상 cron 그대로 동작
--   - REFER_FRIEND_5000 은 audience='manual' — 자동 노출 X, 1:1 발급
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. REFER_FRIEND_5000 쿠폰 시드 ────────────────────────────────────────
-- 피초대자가 가입 직후 받는 5,000원 정액 할인 쿠폰. 1인 1회.
-- audience='manual' — 자동 노출 대상 아님. application/signup 에서 grant.
INSERT INTO public.coupons (
  code, name, description, discount_type, discount_value,
  min_order_amount, max_discount, starts_at, expires_at,
  usage_limit, per_user_limit, is_active, audience_type
) VALUES (
  'REFER_FRIEND_5000',
  '친구 초대 환영 쿠폰',
  '친구 초대 코드로 가입한 분께 자동 발급. 첫 결제에 5,000원 즉시 할인.',
  'fixed', 5000,
  10000,             -- 1만원 이상
  NULL,
  NOW(),
  NOW() + INTERVAL '1 year',
  NULL,              -- 전체 사용량 제한 없음
  1,                 -- 1인 1회
  true,
  'manual'
)
ON CONFLICT (code) DO NOTHING;


-- ── 2. 코멘트 ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.coupons.audience_type IS
  '쿠폰 발급 대상. all=누구나, first_signup=신규, birthday=생일, '
  'inactive_30d=재참여, vip_tier=등급, manual=수동 (referral 환영 쿠폰 포함)';
