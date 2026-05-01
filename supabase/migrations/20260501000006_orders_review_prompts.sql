-- 주문 리뷰 안내 cron (review-prompts) 지원 컬럼.
--
-- review_prompted_at — 한 주문에 후기 안내 메일이 1회만 가도록 마킹.
-- delivered_at 은 이미 있을 가능성 높지만 안전하게 IF NOT EXISTS.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_prompted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 인덱스 — cron 의 WHERE order_status='delivered' AND delivered_at <= cutoff
-- AND review_prompted_at IS NULL 쿼리 가속.
CREATE INDEX IF NOT EXISTS orders_review_prompt_pending_idx
  ON public.orders (delivered_at)
  WHERE order_status = 'delivered' AND review_prompted_at IS NULL;

COMMENT ON COLUMN public.orders.review_prompted_at IS
  '리뷰 안내 메일 발송 시각. NULL 이면 미발송. 1회만 발송.';
COMMENT ON COLUMN public.orders.delivered_at IS
  '배송 완료 시각 (관리자 또는 자동 트리거가 set).';
