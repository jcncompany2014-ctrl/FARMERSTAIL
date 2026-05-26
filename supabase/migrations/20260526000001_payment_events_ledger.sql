-- R60 — 결제 원장 (payment_events) insert-only 이벤트 테이블.
--
-- # 배경
-- 기존 orders.payment_status / order_status 는 *직접 UPDATE* 패턴.
-- → 마지막 상태만 남고 이전 상태 흔적 0. CS / 재무 추적 불가.
--
-- # 설계 — 원장 (Ledger) 패턴
--  - INSERT 만. UPDATE / DELETE 영원히 금지 (DB trigger 강제).
--  - 결제 상태 변경 시 orders.status 도 update 하되, 같이 event 한 줄
--    insert. 이력 영원히 남음.
--  - 환불도 음수 amount 로 insert. SUM = 현재 잔액.
--
-- # 활용
--  - CS: "이 주문 언제 누가 환불했지?" → SELECT * FROM payment_events
--         WHERE order_id = ... ORDER BY created_at
--  - 재무: 일별 매출 = SUM(amount) WHERE event_type IN ('paid', 'refunded')
--  - 감사: source / metadata 로 누가 / 어떤 흐름으로 변경했는지 추적

-- =============================================================================
-- 1. payment_events 테이블
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 주문 / 결제 식별자
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_key text,  -- Toss paymentKey (가상계좌 등 일부 케이스에 늦게 발급)

  -- 이벤트 타입 — 명확한 enum
  event_type text NOT NULL CHECK (event_type IN (
    'paid',                -- 결제 완료
    'refunded',            -- 완전 환불
    'partial_refunded',    -- 부분 환불
    'failed',              -- 결제 실패
    'cancel_requested',    -- 사용자 취소 요청 (실제 환불 전 단계)
    'webhook_received',    -- Toss webhook 수신 (status 변경 없을 수도)
    'admin_action',        -- 관리자 수동 조작
    'cron_refund_queue'    -- 자동 환불 큐 처리
  )),

  -- 금액 — 양수: 결제 발생 / 음수: 환불 발생 / 0: 정보성 이벤트
  amount integer NOT NULL,

  -- 상태 전이 — 디버깅 / 감사용
  prev_status text,  -- 변경 직전 orders.payment_status
  new_status text,   -- 변경 직후 orders.payment_status

  -- 출처 — 어떤 흐름에서 발생했는지
  source text NOT NULL CHECK (source IN (
    'user_checkout',       -- /api/payments/confirm
    'toss_webhook',        -- /api/payments/webhook
    'user_cancel',         -- /api/orders/[id]/cancel
    'partial_cancel',      -- /api/orders/[id]/cancel-items
    'cron_refund_queue',   -- payment_refund_queue retry
    'admin_panel'          -- /admin/refunds
  )),

  -- 추가 정보 — 사유 / 쿠폰 ID / 환불 항목 등
  metadata jsonb,

  -- 누가 했는지 (cron / webhook 은 null)
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. UPDATE / DELETE 강제 차단 (DB trigger)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.block_payment_events_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payment_events is insert-only ledger; UPDATE/DELETE forbidden (op=%, id=%)',
    TG_OP, COALESCE(NEW.id, OLD.id);
END;
$$;

DROP TRIGGER IF EXISTS payment_events_no_update ON public.payment_events;
CREATE TRIGGER payment_events_no_update
  BEFORE UPDATE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.block_payment_events_mutations();

DROP TRIGGER IF EXISTS payment_events_no_delete ON public.payment_events;
CREATE TRIGGER payment_events_no_delete
  BEFORE DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.block_payment_events_mutations();

COMMENT ON FUNCTION public.block_payment_events_mutations() IS
  '결제 원장 불변성 강제. payment_events 는 INSERT 만 허용. R60.';

-- =============================================================================
-- 3. 인덱스
-- =============================================================================

-- 주문별 이벤트 시계열 조회 (가장 흔한 쿼리)
CREATE INDEX IF NOT EXISTS idx_payment_events_order_time
  ON public.payment_events (order_id, created_at DESC);

-- paymentKey 로 직접 조회 (Toss webhook)
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_key
  ON public.payment_events (payment_key)
  WHERE payment_key IS NOT NULL;

-- 이벤트 타입별 통계 (재무 분석)
CREATE INDEX IF NOT EXISTS idx_payment_events_type_time
  ON public.payment_events (event_type, created_at DESC);

-- =============================================================================
-- 4. RLS — 조회는 본인 또는 admin
-- =============================================================================

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 주문 또는 admin
DROP POLICY IF EXISTS "payment_events_select" ON public.payment_events;
CREATE POLICY "payment_events_select" ON public.payment_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_events.order_id
        AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- INSERT: service_role 만 (직접 client 인서트 금지, 서버 코드만)
-- → service_role 은 RLS 우회하므로 별도 INSERT policy 불필요.

-- 일반 사용자 INSERT 차단 — policy 자체를 안 만들면 default DENY.
-- → authenticated / anon 은 INSERT 불가.

COMMENT ON TABLE public.payment_events IS
  '결제 원장 (insert-only ledger). 모든 결제 상태 변경 이벤트. R60.';
