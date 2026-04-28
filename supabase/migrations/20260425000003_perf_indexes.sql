-- =============================================================================
-- Performance indexes — 핫 쿼리 패턴 커버리지.
--
-- # 배경
--
-- 코드베이스 전반에서 `.eq('user_id', ...)` + `.order('created_at')` 패턴이
-- 100+ 군데. 초기 스키마 마이그레이션이 이 디렉터리 외부에 있어 어떤 인덱스가
-- 정의됐는지 한눈에 안 보임. 가장 빈번한 read 패턴에 대한 커버리지를 명시적
-- 으로 추가한다. `IF NOT EXISTS` 라 이미 있으면 noop.
--
-- # 대상
--
-- 1. orders        — /mypage/orders 목록, 알림 unread count, /mypage/page.tsx
-- 2. subscriptions — Dashboard, /mypage/subscriptions, cron 다음 배송 알림
-- 3. dogs          — Dashboard, /dogs 목록
-- 4. reviews       — PDP 리뷰, /mypage/reviews
-- 5. point_ledger  — getCurrentBalance (apply_point_delta 내부)
-- 6. consent_log   — /mypage/consent 이력
-- 7. coupon_redemptions — per-user 사용량 체크, redeem_coupon RPC
-- 8. order_items   — /mypage/orders/[id], 영수증
-- 9. wishlist      — /mypage/wishlist
--
-- # 정책
--
-- - Composite (user_id, created_at DESC) — list + sort 한 번에 커버.
-- - Partial WHERE (status='active' 등) — 활성 row 만 좁히는 쿼리에 좋음.
-- - 모두 `IF NOT EXISTS` — 멱등.
-- =============================================================================

-- ── orders ───────────────────────────────────────────────────────────────────
-- 본인 주문 목록 — /mypage/orders 메인 쿼리. created_at DESC 정렬 동시 커버.
CREATE INDEX IF NOT EXISTS orders_user_created_idx
  ON public.orders (user_id, created_at DESC);

-- 알림 unread count — order_status IN ('shipping','delivered') AND updated_at > X
-- WHERE 절로 대상 좁힘. 이 인덱스는 활성 상태 변경만 빠르게.
CREATE INDEX IF NOT EXISTS orders_user_updated_active_idx
  ON public.orders (user_id, updated_at DESC)
  WHERE order_status IN ('shipping', 'delivered');

-- 관리자 주문 통합 검색 — 결제상태별 필터.
CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (payment_status);

-- ── subscriptions ────────────────────────────────────────────────────────────
-- Dashboard / mypage 활성 구독 1건 lookup — partial index 가 가장 효율적.
CREATE INDEX IF NOT EXISTS subscriptions_user_active_idx
  ON public.subscriptions (user_id, created_at DESC)
  WHERE status = 'active';

-- 배송 임박 cron — 다음 배송일이 오늘/내일인 활성 구독 fetch.
CREATE INDEX IF NOT EXISTS subscriptions_next_delivery_idx
  ON public.subscriptions (next_delivery_date)
  WHERE status = 'active' AND next_delivery_date IS NOT NULL;

-- ── subscription_items ──────────────────────────────────────────────────────
-- 구독 → 아이템 join. 구독 1개당 보통 1-3 row.
CREATE INDEX IF NOT EXISTS subscription_items_subscription_idx
  ON public.subscription_items (subscription_id);

-- ── dogs ────────────────────────────────────────────────────────────────────
-- Dashboard / /dogs 목록 — 본인 강아지 최근 등록순.
CREATE INDEX IF NOT EXISTS dogs_user_created_idx
  ON public.dogs (user_id, created_at DESC);

-- ── reviews ─────────────────────────────────────────────────────────────────
-- PDP 하단 리뷰 — 상품별 최신순.
CREATE INDEX IF NOT EXISTS reviews_product_created_idx
  ON public.reviews (product_id, created_at DESC);

-- /mypage/reviews — 본인 리뷰 최신순.
CREATE INDEX IF NOT EXISTS reviews_user_created_idx
  ON public.reviews (user_id, created_at DESC);

-- ── point_ledger ────────────────────────────────────────────────────────────
-- getCurrentBalance — 가장 최근 row 의 balance_after. 매 결제/적립마다 hit.
-- apply_point_delta RPC 안에서도 사용 (advisory lock 후 SELECT).
CREATE INDEX IF NOT EXISTS point_ledger_user_created_idx
  ON public.point_ledger (user_id, created_at DESC);

-- ── consent_log ─────────────────────────────────────────────────────────────
-- /mypage/consent 이력 — 본인 최신순 limit 10.
CREATE INDEX IF NOT EXISTS consent_log_user_granted_idx
  ON public.consent_log (user_id, granted_at DESC);

-- ── coupon_redemptions ──────────────────────────────────────────────────────
-- per_user_limit 체크 — coupon × user 조합 카운트.
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_coupon_idx
  ON public.coupon_redemptions (user_id, coupon_id);

-- ── order_items ─────────────────────────────────────────────────────────────
-- 주문 → 아이템 join. /mypage/orders/[id] 상세, 이메일 영수증.
CREATE INDEX IF NOT EXISTS order_items_order_idx
  ON public.order_items (order_id);

-- ── wishlist (테이블 이름이 'wishlists' 일 수 있음, 두 변형 모두 시도) ─────
-- 본인 위시리스트 lookup. 테이블이 없거나 이미 인덱스 있으면 noop.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'wishlists') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS wishlists_user_idx ON public.wishlists (user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'wishlist') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS wishlist_user_idx ON public.wishlist (user_id)';
  END IF;
END$$;

-- ANALYZE — 통계 갱신해 새 인덱스를 플래너가 즉시 활용.
ANALYZE public.orders;
ANALYZE public.subscriptions;
ANALYZE public.dogs;
ANALYZE public.reviews;
ANALYZE public.point_ledger;
ANALYZE public.consent_log;
ANALYZE public.coupon_redemptions;
ANALYZE public.order_items;
