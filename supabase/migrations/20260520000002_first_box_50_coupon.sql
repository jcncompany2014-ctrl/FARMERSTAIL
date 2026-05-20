-- Round B (2026-05-20): FIRSTBOX50 쿠폰 시드 — 첫 박스 50% 할인.
--
-- 분석 페이지 카피 "첫 박스 50% off" 를 실제 쿠폰으로 구체화.
-- WelcomeCouponBanner 가 audience_type='first_signup' 의 최신 1건을 자동
-- 픽업하므로 FIRSTBOX50 INSERT 후 created_at 이 가장 최근이면 자동 노출.
--
-- 정책:
--   - 50% 할인, 최대 할인 30,000원 (1팩 약 6만원 기준)
--   - 최소 주문 금액 제한 없음 (입문 진입 장벽 ↓)
--   - 1인 1회 (per_user_limit=1)
--   - audience_type='first_signup' (신규 회원만 자동 적용)
--   - 1년 만기, 만료 후 admin 에서 연장 또는 새 쿠폰 발행.
--
-- 멱등성: ON CONFLICT (code) DO NOTHING — 이미 있으면 건드리지 않음.

INSERT INTO public.coupons (
  code,
  name,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  max_discount,
  starts_at,
  expires_at,
  usage_limit,
  per_user_limit,
  audience_type,
  is_active
) VALUES (
  'FIRSTBOX50',
  '첫 박스 50% 할인',
  '신규 가입 후 첫 결제에 자동 적용되는 50% 할인 쿠폰. 최대 30,000원 할인.',
  'percent',
  50,
  0,                        -- 최소 주문 금액 0
  30000,                    -- 최대 30,000원 할인
  now(),
  now() + interval '1 year',
  null,                     -- 전체 한도 무제한
  1,                        -- 1인 1회
  'first_signup',
  true
)
ON CONFLICT (code) DO NOTHING;
