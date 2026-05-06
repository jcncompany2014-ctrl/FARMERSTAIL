-- ============================================================================
-- Migration: reserve_order_stock RPC + order-expire 인프라 (#3 race condition)
-- ============================================================================
--
-- # 문제
-- 현재 CheckoutForm 이 orders + order_items insert 만 하고 products.stock 은
-- 건드리지 않음. 즉:
--   사용자 A: stock=1 인 상품 결제 진행 (orders insert 후 Toss SDK)
--   사용자 B: 동시에 같은 stock=1 상품 결제 진행
--   둘 다 Toss confirm 성공 → 둘 다 paid → admin 발송 시 1개만 보내고 1개 oversell
--
-- # 해결
-- public.reserve_order_stock(items jsonb) RPC — 다음을 원자적 (FOR UPDATE)
-- 으로 처리:
--   1. 모든 product row 를 id 순으로 FOR UPDATE lock (deadlock 방지)
--   2. 부족분 (stock < qty) 검출 → 있으면 일찍 jsonb 에러 반환
--   3. 모두 OK 면 일괄 decrement
-- 호출처 (CheckoutForm) 는 응답의 ok=false 면 사용자에게 "품절" 안내 + 주문
-- 롤백.
--
-- # 잔여 위험
-- 주문 생성 후 사용자가 Toss 페이지에서 이탈하면 stock 이 30분+ "예약" 상태로
-- 묶임. /api/cron/order-expire 가 30분 + 결제 미완료 주문을 expired 로 전환
-- 하면서 restore_stock RPC 호출 → 회수.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reserve_order_stock(items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  insufficient jsonb := '[]'::jsonb;
  it jsonb;
  pid uuid;
  q int;
  cur_stock int;
BEGIN
  IF items IS NULL OR jsonb_array_length(items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_items');
  END IF;

  -- Lock all rows up-front, ordered by id for consistent ordering across
  -- concurrent transactions (Postgres lock ordering = deadlock 회피).
  PERFORM stock FROM public.products
    WHERE id IN (
      SELECT DISTINCT (val->>'product_id')::uuid
      FROM jsonb_array_elements(items) val
    )
    ORDER BY id
    FOR UPDATE;

  -- Pass 1: 부족분 검출 (decrement 안 함 — 모두 모자라면 Atomic 실패).
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (it->>'product_id')::uuid;
    q := COALESCE((it->>'qty')::int, 0);
    IF q <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'invalid_qty',
        'product_id', pid::text
      );
    END IF;
    SELECT stock INTO cur_stock FROM public.products WHERE id = pid;
    IF cur_stock IS NULL OR cur_stock < q THEN
      insufficient := insufficient || jsonb_build_array(
        jsonb_build_object(
          'product_id', pid::text,
          'requested', q,
          'available', COALESCE(cur_stock, 0)
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(insufficient) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_stock',
      'insufficient', insufficient
    );
  END IF;

  -- Pass 2: 일괄 decrement.
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (it->>'product_id')::uuid;
    q := (it->>'qty')::int;
    UPDATE public.products
      SET stock = stock - q,
          updated_at = now()
      WHERE id = pid;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.reserve_order_stock IS
  '주문 시 atomic stock decrement. items=[{product_id,qty},...]. 부족분 있으면 ok=false 반환.';

REVOKE ALL ON FUNCTION public.reserve_order_stock FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock TO authenticated, service_role;
