-- 취소 사용포인트 환급을 원자적으로 — 동시성 과다환급 + refunds 결합 손실 차단.
--
-- 배경(점검 재검증): 라우트에서 points_refunded 를 read-modify-write 로 상한
-- 처리하면 서로 다른 항목을 취소하는 동시 부분취소 2건이 같은 stale 값을 읽어
-- 총 환급이 points_used 를 초과할 수 있고, ledger reference 를 refunds.id 에
-- 결합하면 refunds insert 실패 시 환급이 통째로 누락됐다.
--
-- 해결: 이 RPC 가 orders 행을 FOR UPDATE 로 잠그고, 잔여 환급가능분
-- (points_used - points_refunded)을 상한으로 reserve + apply_point_delta 로
-- 원장 적립 + points_refunded 증가를 단일 트랜잭션에서 수행한다. 동시 호출은
-- 행 잠금으로 직렬화되어 총 환급이 절대 points_used 를 넘지 않는다. reference 는
-- 호출처가 이벤트별 유일 uuid 로 넘기므로 refunds insert 성패와 무관.
--
-- 반환: 실제 환급(적립)된 포인트. 0 이면 잔여 없음/주문 없음.
-- 서버 전용(service_role). ※ 적용은 창업자 검토 후.

CREATE OR REPLACE FUNCTION public.refund_order_points(
  p_order_id     uuid,
  p_user_id      uuid,
  p_request      integer,
  p_reason       text,
  p_reference_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_used     int;
  v_refunded int;
  v_claim    int;
BEGIN
  SELECT COALESCE(points_used, 0), COALESCE(points_refunded, 0)
    INTO v_used, v_refunded
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 이번에 환급할 양 = min(요청, 잔여 환급가능분). 음수 방지.
  v_claim := LEAST(GREATEST(COALESCE(p_request, 0), 0),
                   GREATEST(v_used - v_refunded, 0));

  IF v_claim <= 0 THEN
    RETURN 0;
  END IF;

  -- 원장 적립 (advisory lock + balance 계산 + reference 멱등). 양수 delta 라 실패 없음.
  PERFORM public.apply_point_delta(
    p_user_id, v_claim, p_reason, 'order_refund_credit', p_reference_id
  );

  UPDATE public.orders
  SET points_refunded = COALESCE(points_refunded, 0) + v_claim
  WHERE id = p_order_id;

  RETURN v_claim;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_order_points(uuid, uuid, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_order_points(uuid, uuid, integer, text, uuid) TO service_role;

COMMENT ON FUNCTION public.refund_order_points(uuid, uuid, integer, text, uuid) IS
  '취소 사용포인트 환급을 orders 행 잠금으로 원자 reserve+적립. 총 환급 <= points_used 보장(동시성 안전).';
