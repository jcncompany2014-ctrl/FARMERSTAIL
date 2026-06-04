-- 첫 박스 50% 할인 쿠폰 (FIRSTBOX50).
--
-- # 배경
--   copy-strings(first_box_offer) / FAQ 가 "첫 박스 50%" 를 말하는데 실제 쿠폰이
--   없어(WELCOME10/WELCOME5000 뿐) 표기가 사실과 어긋났음. 창업자 결정 — 실제로
--   50% 로 간다.
--
-- # 자동 적용 경로
--   audience_type='first_signup' + 가장 최신 created_at 이라 app/checkout/page.tsx
--   의 firstSignupCoupon 쿼리(.eq('audience_type','first_signup').order(created_at
--   desc).limit(1)) 가 이걸 집어 autoApplyCouponCode 로 넘긴다 → 첫 주문(paid 0건)
--   사용자에게 코드 입력 없이 자동 적용. per_user_limit=1 로 1회만.
--
-- # 주의 — 상한 없음
--   max_discount=NULL → 진짜 50% (상한 없음). 큰 첫 주문엔 할인 노출이 클 수 있음.
--   필요하면 max_discount 에 상한(원)을 넣어 마진 보호 가능.

INSERT INTO coupons (
  code, name, description, discount_type, discount_value,
  min_order_amount, max_discount, usage_limit, per_user_limit,
  is_active, audience_type
) VALUES (
  'FIRSTBOX50',
  '첫 박스 50% 할인',
  '첫 주문 한정 · 50% 할인. 부담 없이 시작해 보세요.',
  'percent', 50, 0, NULL, NULL, 1, true, 'first_signup'
)
ON CONFLICT (code) DO UPDATE SET
  name           = EXCLUDED.name,
  description    = EXCLUDED.description,
  discount_type  = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order_amount = EXCLUDED.min_order_amount,
  max_discount   = EXCLUDED.max_discount,
  per_user_limit = EXCLUDED.per_user_limit,
  is_active      = EXCLUDED.is_active,
  audience_type  = EXCLUDED.audience_type;
