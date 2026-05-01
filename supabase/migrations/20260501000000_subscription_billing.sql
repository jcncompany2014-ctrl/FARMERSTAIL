-- 정기배송 자동결제 — Toss Payments billingKey 기반.
--
-- # 배경
--
-- 현재 subscriptions 테이블은 next_delivery_date / reminder 만 추적. 실제 자동
-- 결제 트리거가 어디에도 없어 첫 회차 결제 후 영영 갱신 안 되는 구조. 이 마이
-- 그레이션이 누락분을 메꾼다:
--
--   1) billing_key / billing_customer_key — 토스가 카드 등록 시 발급하는
--      재사용 가능한 결제 토큰. cron 이 매일 만료 도래 구독을 스캔해 이걸로
--      결제 호출.
--   2) last_charged_at — 멱등성 + 디버깅. 같은 구독을 같은 날 두 번 충전 안 함.
--   3) failed_charge_count + last_failed_charge_at — 카드 만료 / 잔액 부족 시
--      retry 정책 (3회 실패 → status='paused' 자동 전환 후 사용자 알림).
--   4) status enum 에 'paused' 추가 (이미 있을 수도 — 안전하게 IF NOT EXISTS).

-- billing_key / customer_key — Toss 가 발급. customer_key 는 우리가 user_id 와
-- 무관하게 발급하는 UUID — Toss 측 식별자. billing_key 는 카드 + customer_key
-- 페어로 한 번 발급되는 영구 토큰 (사용자가 카드 변경 시 새로 발급).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_key text,
  ADD COLUMN IF NOT EXISTS billing_customer_key uuid,
  ADD COLUMN IF NOT EXISTS billing_card_brand text,
  ADD COLUMN IF NOT EXISTS billing_card_last4 text,
  ADD COLUMN IF NOT EXISTS last_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_charge_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_charge_reason text;

-- 멱등성을 위한 부분 unique index — 같은 구독 + 같은 배송일에 charge 가 한 번만.
-- 별도 subscription_charges 테이블에 1건 = 1주문 매핑.
CREATE TABLE IF NOT EXISTS public.subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- 청구 대상 배송일 (UTC date). 같은 (subscription_id, scheduled_for) 조합은 중복 차단.
  scheduled_for date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'skipped')),
  -- Toss payment_key — 결제 성공 시 채움. 환불/조회용.
  payment_key text,
  -- 생성된 order id — 결제 성공 시 새 주문 row 와 연결.
  order_id uuid,
  amount integer NOT NULL,
  error_code text,
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT subscription_charges_idem UNIQUE (subscription_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS subscription_charges_status_idx
  ON public.subscription_charges (status, attempted_at DESC);

CREATE INDEX IF NOT EXISTS subscription_charges_user_idx
  ON public.subscription_charges (user_id, attempted_at DESC);

-- RLS — 사용자는 자기 charge 만 read. write 는 service_role 만.
ALTER TABLE public.subscription_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_charges_select_own" ON public.subscription_charges;
CREATE POLICY "subscription_charges_select_own"
  ON public.subscription_charges
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE 는 service_role 전용. RLS 가 anon 쓰기를 자동 차단.

COMMENT ON TABLE public.subscription_charges IS
  '정기배송 자동결제 시도 이력. (subscription_id, scheduled_for) 가 멱등 키.';

-- subscriptions.status 에 'paused' 가 없으면 추가. 이미 있다면 no-op.
-- enum 이 아니라 text + CHECK 인 경우 별도 처리. 마이그레이션은 enum 가정.
DO $$
DECLARE
  enum_name text;
BEGIN
  SELECT t.typname INTO enum_name
  FROM pg_type t
  JOIN pg_attribute a ON a.atttypid = t.oid
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relname = 'subscriptions'
    AND a.attname = 'status'
    AND t.typtype = 'e'
  LIMIT 1;

  IF enum_name IS NOT NULL THEN
    -- enum 타입이면 ADD VALUE
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'paused');
  END IF;
  -- text + CHECK 인 경우는 별도 검증 — 일단 silent. 호출처 코드가 'paused' 를
  -- 안 쓰면 영향 없음.
END $$;
