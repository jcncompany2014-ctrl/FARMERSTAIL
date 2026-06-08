-- 웹훅 멱등 — 같은 결제 이벤트의 동시 수신/재시도 중복처리 방지.
--
-- 배경: Toss 는 webhook 을 비-2xx 응답 시 자동 재시도하고, 드물게 같은
-- 이벤트가 동시에 두 번 들어올 수 있다. 현재 핸들러는 주문 상태(payment_status)
-- 로 멱등을 보장하지만, 두 요청이 거의 동시에 "아직 paid 아님"을 읽으면 둘 다
-- 적립·알림을 실행하는 race 틈이 남는다(이중 포인트 적립 등).
--
-- 해결: (provider, event_key) 를 이 테이블에 **원자적 INSERT** 로 먼저 기록.
-- event_key = paymentKey:status (전이 단위). unique 충돌이 나는 쪽은 "이미
-- 누군가 처리 중/완료"로 보고 즉시 skip → 동시 요청이 직렬화되어 한 번만 처리.
--
-- 서버 전용(웹훅이 service_role 로 INSERT, RLS 우회). 클라이언트 접근 차단(정책
-- 없음=deny-all) + 관리자 read 만. 적용은 창업자 검토 후.
-- ※ 무한 증가 — 추후 90일 정리 cron 권장(restock_alerts/cron_health 와 동일).

BEGIN;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'toss',
  event_key text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_key text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 동시 수신 직렬화의 핵심 — (provider, event_key) 유니크.
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_key_uniq
  ON public.webhook_events (provider, event_key);

-- 운영 조회(주문별 이벤트 추적).
CREATE INDEX IF NOT EXISTS webhook_events_order_idx
  ON public.webhook_events (order_id, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 클라이언트 접근 전면 차단(서버 전용). 관리자만 read.
CREATE POLICY webhook_events_admin_read ON public.webhook_events
  FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.webhook_events IS
  '결제 웹훅 멱등 게이트. event_key=paymentKey:status, (provider,event_key) 유니크로 동시·재시도 중복처리 차단.';

COMMIT;
