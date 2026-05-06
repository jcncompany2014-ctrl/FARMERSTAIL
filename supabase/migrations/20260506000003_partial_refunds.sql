-- ============================================================================
-- Migration: 부분 취소 / 환불 인프라 (#2)
-- ============================================================================
--
-- # 배경
-- 현재 /api/orders/[id]/cancel 은 "전체 취소" 만 지원. 사용자가 4팩 정기배송
-- 중 1팩만 취소하고 싶거나, 카트 결제 후 1상품만 빼고 싶을 때 경로 없음.
-- 또한 환불 이력이 별도 테이블로 보존되지 않아 admin 통계·CS 추적이 어려움.
--
-- # 추가 요소
-- 1) order_items.cancelled_at + refunded_amount → 항목 단위 취소 상태 보존.
-- 2) public.refunds — 환불 audit 테이블. Toss transactionKey 와 매핑.
-- 3) public.restore_stock() RPC — 취소 시 product.stock 원자적으로 복원.
-- 4) 기존 orders.refunded_amount 와 정합 — refunds 합계가 orders.refunded_amount.
-- ============================================================================

-- ── order_items 부분 취소 컬럼 ────────────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_amount integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.order_items.cancelled_at IS
  '항목 단위 취소 시각. NULL = 정상. 부분 취소 시 채워짐.';
COMMENT ON COLUMN public.order_items.refunded_amount IS
  '항목 단위 환불 금액 (line_total <= 환불액 <= line_total). 합계는 orders.refunded_amount.';

-- ── refunds audit 테이블 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text,
  -- Toss cancel 응답의 transactionKey (각 cancel 행위 고유 식별자).
  -- payment_key 는 결제 1건에 1개지만 부분 취소가 N번이면 N개의 transactionKey.
  toss_transaction_key text,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  -- NULL = 고객 self-service, 그 외 = admin user_id.
  refunded_by uuid,
  status text NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  -- 어떤 항목이 환불됐는지. 전체 취소 시 NULL.
  order_item_ids uuid[],
  -- 메타: full vs partial.
  is_partial boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds (order_id, refunded_at DESC);
CREATE INDEX IF NOT EXISTS refunds_user_idx ON public.refunds (user_id, refunded_at DESC);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds (status) WHERE status != 'succeeded';

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_select_own ON public.refunds;
CREATE POLICY refunds_select_own ON public.refunds
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE 는 service_role 전용.
COMMENT ON TABLE public.refunds IS
  '환불 audit log. Toss cancel 응답 1건당 1 row. 부분 취소면 is_partial=true + order_item_ids 채움.';

-- ── restore_stock RPC ────────────────────────────────────────────────────
-- 취소 시 product.stock 을 원자적으로 복원. 동시 청구 race condition 회피.
-- DECREMENT 는 별도 (#3 재고 race condition) — 여기선 INCREMENT 만.
CREATE OR REPLACE FUNCTION public.restore_stock(p_product_id uuid, p_qty int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_stock int;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'restore_stock: qty must be positive (got %)', p_qty;
  END IF;
  UPDATE public.products
    SET stock = COALESCE(stock, 0) + p_qty,
        updated_at = now()
    WHERE id = p_product_id
  RETURNING stock INTO new_stock;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restore_stock: product not found (%)', p_product_id;
  END IF;
  RETURN new_stock;
END;
$$;

COMMENT ON FUNCTION public.restore_stock IS
  '주문 취소 시 product.stock 복원. 동시성 안전 (단일 UPDATE).';

REVOKE ALL ON FUNCTION public.restore_stock FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_stock TO service_role;
