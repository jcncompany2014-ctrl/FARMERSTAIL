-- WELCOME10 / WELCOME5000 비활성화.
--
-- FIRSTBOX50(첫 박스 50%) 도입으로 같은 first_signup 대상의 10% / 5,000원
-- 쿠폰은 항상 50% 보다 불리 → 첫 주문 쿠폰함에 3장이 보여 혼란만 줌.
-- is_active=false 로 숨긴다 (삭제 아님 — 이력/되돌리기 보존). 필요 시 다시 켜기.

UPDATE coupons
SET is_active = false
WHERE code IN ('WELCOME10', 'WELCOME5000');
