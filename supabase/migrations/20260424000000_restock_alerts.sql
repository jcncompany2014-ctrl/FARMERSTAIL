-- 재입고 알림 구독 테이블.
--
-- 품절(stock=0) 상태의 상품 PDP에서 고객이 "재입고 알림 받기" 를 누르면
-- 한 행을 만든다. 관리자가 stock>0 으로 되돌리면 cron/edge function 이
-- 아래 테이블을 스캔해 email+web-push 로 통지한다.
--
-- 설계 포인트
-- ----------
--  * variant 단위 구독을 지원한다. 카탈로그가 "대용량 팩 / 소포장" 처럼
--    variant 재고를 따로 관리하는 경우, 대용량만 품절이고 소포장은 있는데
--    "재입고 알림" 을 누르는 고객에게 "재입고됐어요" 라고 보내면 오해가 생김.
--    variant_id NULL == 상품 전체 재입고(variant 없는 상품).
--  * (user_id, product_id, variant_id) 유니크 — 같은 상품을 여러 번 눌러도
--    알림 한 번. variant_id NULL 까지 포함한 COALESCE 를 써야 NULL 끼리
--    중복이 막힌다 (Postgres 의 NULL != NULL 때문에 단순 unique 는 뚫림).
--  * notified_at — 한 번 알리면 자동 해제되도록 기록. 재구독을 원하면
--    UI 에서 row 를 지우고 다시 insert.
--
-- RLS
-- ---
--  * 본인 구독만 select / insert / delete.
--  * admin 은 전체 read/write (cron이 service_role 로 돌면 RLS bypass,
--    관리자 UI는 자신의 jwt role 로 읽기 허용).

BEGIN;

CREATE TABLE IF NOT EXISTS public.restock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- (user, product, variant) 유니크. NULL variant_id 끼리도 구별되도록
-- COALESCE 로 gen sentinel (0 uuid) — 함수 기반 UNIQUE INDEX 사용.
CREATE UNIQUE INDEX IF NOT EXISTS restock_alerts_uniq_user_product_variant
  ON public.restock_alerts (
    user_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 미통지 행만 스캔하는 partial index — cron job 이 "이번에 재입고됐는데
-- 아직 못 알린" 행을 찾을 때 사용.
CREATE INDEX IF NOT EXISTS restock_alerts_pending_idx
  ON public.restock_alerts (product_id, variant_id)
  WHERE notified_at IS NULL;

-- 유저의 구독 내역 조회 속도용 (마이페이지 등).
CREATE INDEX IF NOT EXISTS restock_alerts_user_idx
  ON public.restock_alerts (user_id, created_at DESC);

-- RLS 활성화.
ALTER TABLE public.restock_alerts ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 SELECT.
CREATE POLICY restock_alerts_self_select ON public.restock_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 구독만 INSERT.
CREATE POLICY restock_alerts_self_insert ON public.restock_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 구독만 DELETE (구독 취소).
CREATE POLICY restock_alerts_self_delete ON public.restock_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- 관리자 읽기 전용 — 대시보드에서 "이 상품을 몇 명이 기다리나" 확인용.
CREATE POLICY restock_alerts_admin_read ON public.restock_alerts
  FOR SELECT
  USING (public.is_admin(auth.uid()));

COMMENT ON TABLE public.restock_alerts IS
  '품절 상품 재입고 알림 구독. variant_id NULL 은 variant 없는 상품 전체 구독.';
COMMENT ON COLUMN public.restock_alerts.notified_at IS
  '재입고 통지(이메일+푸시) 완료 시점. NULL 이면 대기.';

COMMIT;
