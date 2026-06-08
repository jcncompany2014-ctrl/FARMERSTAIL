-- 사용 포인트 환급 상한 추적 — 부분/전량 취소 중복 환급 방지.
--
-- 배경: 주문 취소 시 결제에 쓴 points_used 를 환급(order_refund_credit)한다.
-- 그런데 부분취소(cancel-items)와 전량취소(cancel)가 모두 reference_id=order.id
-- 로 ledger 에 적으면 uq_point_ledger_reference (user, type, ref) 유니크에 막혀
-- 2회차 이후 환급이 silent 차단(already_applied)돼 고객이 포인트를 잃거나,
-- reference 를 이벤트별로 바꾸면 이번엔 부분취소 후 전량취소가 전액을 또 환급해
-- 과다 환급이 된다.
--
-- 해결: refunds.id 를 ledger reference 로 써 이벤트별 유일성을 주되, 이 컬럼으로
-- "이미 환급한 사용포인트 누적분"을 추적해 매 환급을 (points_used - points_refunded)
-- 상한으로 묶는다. 총 환급은 절대 points_used 를 넘지 않고, 순차 취소도 누락 없음.
--
-- additive · default 0 · 기존 행/기능 영향 없음. ※ 적용은 창업자 검토 후(빈 orders
-- 테이블이라 무위험).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_refunded integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.points_refunded IS
  '누적 환급된 사용 포인트(points_used 중 환급 완료분). 부분/전량 취소 중복 환급 방지 상한.';
