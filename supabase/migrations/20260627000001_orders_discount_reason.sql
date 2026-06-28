-- ============================================================================
-- Migration: orders.discount_reason — 자동 할인(쿠폰 대체) 적용 사유 기록
-- ============================================================================
--
-- # 배경
-- 쿠폰 시스템 폐기 → 자동 할인 전환(③ 결제 연결). 주문 1건에 어떤 자동 할인이
-- 적용됐는지 기록한다. 값은 lib/discount.ts 의 DiscountReason 과 1:1:
--   'first_order' | 'tier' | 'birthday' | 'none'
--
-- # 용도
--   1) "연 N회" 한도 집계 — 올해 적용된 tier/birthday 할인 횟수를 주문 이력에서
--      세서 computeAutoDiscount 에 입력(꽃 연2회·열매 연4회·생일 연1회).
--   2) 주문 상세 표시 / 정산 감사.
--
-- # 적용 순서 (중요)
-- 이 migration 은 ③ 결제 연결 **코드 배포 前**에 적용한다. 코드가 주문 생성 시
-- 이 컬럼에 write 하므로, 컬럼이 없으면 정기결제가 깨진다. (쿠폰 테이블 DROP 은
-- 반대로 코드 배포 後 — 별도 마이그.)
--
-- # 기존 행
-- 쿠폰 시절 주문은 discount_reason = NULL (미기록). 자동할인 적용 주문부터 채워짐.
-- ============================================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_reason text;

-- 허용 값 가드 — 엔진의 DiscountReason 4종 + NULL(미기록).
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_discount_reason_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_reason_check
  CHECK (
    discount_reason IS NULL
    OR discount_reason IN ('first_order', 'tier', 'birthday', 'none')
  );

COMMENT ON COLUMN public.orders.discount_reason IS
  '자동 할인 적용 사유(lib/discount.ts DiscountReason). first_order|tier|birthday|none, '
  'NULL=미기록(쿠폰 시절). 연 N회 한도 집계 + 주문 상세 표시에 사용.';

-- "올해 등급/생일 할인 사용 횟수" 집계 가속 — 결제 완료(paid_at) 기준 user별 reason별.
CREATE INDEX IF NOT EXISTS orders_user_discount_reason_idx
  ON public.orders (user_id, discount_reason, paid_at)
  WHERE discount_reason IN ('tier', 'birthday');

COMMIT;
