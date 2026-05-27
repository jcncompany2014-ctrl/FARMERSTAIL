-- ============================================================================
-- R83-1 + R83-8: 부분 환불 (partially_refunded) 데이터 정합성 + 회계 무결성
-- ============================================================================
--
-- # 배경 (R83 6-agent audit C3)
--
-- `sales_count` (products.sales_count) 와 `cumulative_spend` (profiles.cumulative_spend)
-- 트리거는 `payment_status in ('cancelled', 'refunded')` 일 때만 차감한다.
-- 하지만 cancel-items / partial-cancel 라우트는 부분 환불 시 payment_status 를
-- `partially_refunded` 로 set → 트리거가 trigger 안 됨 →
--   - 베스트 정렬에서 환불된 분량이 그대로 누적
--   - VIP 등급 누적액에 환불분 그대로 남음 (등급 인플레)
--
-- # 해결
--
-- 1) `refunds` 테이블 INSERT 트리거 추가:
--    - is_partial=true: order_item_ids 의 각 product 별 quantity 합계만큼 sales_count 차감,
--      cumulative_spend 는 refunds.amount 만큼 차감
--    - is_partial=false (전액 환불 경유): 기존 orders 트리거가 처리하므로 skip
--
-- 2) `refunds.order_id` 및 `payment_refund_queue.order_id` FK 를
--    `ON DELETE CASCADE` → `ON DELETE RESTRICT` 로 변경 (R83 C1/C2).
--    회계 audit 은 orders 가 어떤 이유로든 사라져도 보존돼야 한다.
--    orders 는 hard-delete 안 하는 정책 (soft-delete = cancelled).
-- ============================================================================

-- ── 1) refunds 트리거 — 부분 환불 시 sales_count + cumulative_spend 차감 ──

CREATE OR REPLACE FUNCTION public.tg_refunds_apply_partial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  -- 전체 환불은 orders.payment_status 변경 트리거 (sales_count + tier_spend) 가
  -- 이미 처리하므로 skip — 중복 차감 방지.
  IF NOT NEW.is_partial THEN
    RETURN NEW;
  END IF;

  -- status='succeeded' 만 카운트. pending/failed 환불은 미반영.
  IF NEW.status IS DISTINCT FROM 'succeeded' THEN
    RETURN NEW;
  END IF;

  -- sales_count 차감 — 환불된 order_item 들의 product 별 quantity 합.
  IF NEW.order_item_ids IS NOT NULL AND array_length(NEW.order_item_ids, 1) > 0 THEN
    FOR rec IN
      SELECT product_id, sum(quantity)::int AS q
      FROM public.order_items
      WHERE id = ANY(NEW.order_item_ids)
      GROUP BY product_id
    LOOP
      UPDATE public.products
        SET sales_count = greatest(0, sales_count - rec.q)
      WHERE id = rec.product_id;
    END LOOP;
  END IF;

  -- cumulative_spend 차감 — refunds.amount 만큼.
  IF NEW.user_id IS NOT NULL AND NEW.amount > 0 THEN
    UPDATE public.profiles
      SET cumulative_spend = greatest(0, cumulative_spend - NEW.amount)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refunds_apply_partial ON public.refunds;
CREATE TRIGGER refunds_apply_partial
  AFTER INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_refunds_apply_partial();

-- ── 2) refunds.order_id FK : CASCADE → RESTRICT ───────────────────────────

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.refunds'::regclass
    AND contype = 'f'
    AND conkey = (SELECT array_agg(attnum)
                  FROM pg_attribute
                  WHERE attrelid = 'public.refunds'::regclass
                    AND attname = 'order_id');
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.refunds DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

-- ── 3) payment_refund_queue.order_id FK : CASCADE → RESTRICT ──────────────

DO $$
DECLARE
  tbl_exists boolean;
  fk_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'payment_refund_queue'
      AND relnamespace = 'public'::regnamespace
  ) INTO tbl_exists;

  IF tbl_exists THEN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.payment_refund_queue'::regclass
      AND contype = 'f'
      AND conkey = (SELECT array_agg(attnum)
                    FROM pg_attribute
                    WHERE attrelid = 'public.payment_refund_queue'::regclass
                      AND attname = 'order_id');
    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.payment_refund_queue DROP CONSTRAINT %I', fk_name);
      EXECUTE 'ALTER TABLE public.payment_refund_queue
               ADD CONSTRAINT payment_refund_queue_order_id_fkey
               FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT';
    END IF;
  END IF;
END $$;

COMMENT ON TRIGGER refunds_apply_partial ON public.refunds IS
  'R83: 부분 환불 시 sales_count + cumulative_spend 차감. 전체 환불은 orders 트리거가 처리.';
