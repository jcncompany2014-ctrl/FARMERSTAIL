-- audit 2-2: 결제 confirm 후 DB 업데이트 실패 시 자동 환불 큐.
--
-- 시나리오:
--   1. Toss DONE 승인 완료 (사용자는 결제 완료 됨)
--   2. orders UPDATE 실패 (Supabase 일시 장애 / RLS issue / 등)
--   3. cancelPayment 즉시 호출 → 성공이면 끝
--   4. cancelPayment 도 실패면 본 큐에 기록 → cron 이 N분마다 재시도
--
-- 운영 cron 패턴 (다음 단계): pg_cron 로 5분마다 SELECT FOR UPDATE SKIP LOCKED
-- 로 row 잡고 cancelPayment 재호출, succeeded 면 status='succeeded', 실패
-- attempts++ 까지 5회 → permanently_failed 마킹 후 Sentry 알림.

CREATE TABLE IF NOT EXISTS payment_refund_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  payment_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'succeeded', 'permanently_failed')
  ),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_refund_queue_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_refund_queue_status_retry
  ON payment_refund_queue (status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payment_refund_queue_order
  ON payment_refund_queue (order_id);

-- 같은 (paymentKey, reason) 의 pending row 중복 방지.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refund_queue_pending
  ON payment_refund_queue (payment_key, reason)
  WHERE status = 'pending';

ALTER TABLE payment_refund_queue ENABLE ROW LEVEL SECURITY;
-- 사용자가 직접 접근할 일 없음 — service_role 전용.

-- updated_at 자동 갱신.
CREATE OR REPLACE FUNCTION touch_payment_refund_queue()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_payment_refund_queue ON payment_refund_queue;
CREATE TRIGGER trg_touch_payment_refund_queue
  BEFORE UPDATE ON payment_refund_queue
  FOR EACH ROW EXECUTE FUNCTION touch_payment_refund_queue();
