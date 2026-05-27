-- R88-C: hot path partial indexes + 중복 index 정리.
--
-- agent audit (R88): 22 products 현재는 Seq Scan OK 지만 1000명 이상 catalog 정렬 +
-- 30분 cron full scan 부담 → prophylactic.

-- 1) tracking-poll cron (30분마다): order_status='shipping' + tracking + 미배송
CREATE INDEX IF NOT EXISTS orders_shipping_tracking_idx
  ON public.orders (shipped_at)
  WHERE order_status = 'shipping'
    AND tracking_number IS NOT NULL
    AND delivered_at IS NULL;

-- 2) order-expire cron (30분마다): pending payment + pending order + 30분 경과
CREATE INDEX IF NOT EXISTS orders_pending_expire_idx
  ON public.orders (created_at)
  WHERE payment_status = 'pending' AND order_status = 'pending';

-- 3) /products 기본 정렬 (sort_order ASC, is_active=true)
CREATE INDEX IF NOT EXISTS products_active_sort_idx
  ON public.products (sort_order)
  WHERE is_active = true;

-- 4) /products 가격 정렬
CREATE INDEX IF NOT EXISTS products_active_price_idx
  ON public.products (price)
  WHERE is_active = true;

-- 5) 카테고리 필터 + 정렬
CREATE INDEX IF NOT EXISTS products_category_active_idx
  ON public.products (category, sort_order)
  WHERE is_active = true;

-- 6) subscription-charge cron (requires_billing_key_renewal 포함 partial)
CREATE INDEX IF NOT EXISTS subscriptions_charge_due_idx
  ON public.subscriptions (next_delivery_date)
  WHERE status = 'active'
    AND requires_billing_key_renewal = false
    AND billing_key IS NOT NULL;

-- ── 중복/redundant 인덱스 9개 DROP (write overhead 절감) ──
-- 다른 인덱스의 prefix 거나 동일한 DDL.

DROP INDEX IF EXISTS public.point_ledger_user_idx;
DROP INDEX IF EXISTS public.reviews_product_idx;
DROP INDEX IF EXISTS public.reviews_user_idx;
DROP INDEX IF EXISTS public.order_items_order_id_idx;
DROP INDEX IF EXISTS public.orders_user_id_idx;
DROP INDEX IF EXISTS public.orders_order_number_idx;
DROP INDEX IF EXISTS public.subscriptions_user_id_idx;
DROP INDEX IF EXISTS public.subscription_items_sub_id_idx;
DROP INDEX IF EXISTS public.coupon_redemptions_user_idx;
