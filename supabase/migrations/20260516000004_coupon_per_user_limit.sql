-- audit 2-9: redeem_coupon 이 per_user_limit 검사를 하지 않아 race condition
-- 으로 한 사용자가 같은 쿠폰을 N번 사용 가능했음. validateCoupon (앱 코드)
-- 이 SELECT COUNT 로 사전 검사하지만 두 탭에서 동시 호출 시 둘 다 통과 →
-- 둘 다 INSERT.
--
-- 해법: redeem_coupon RPC 에서 row lock 보유 중에 per_user_limit 도 검사.
-- 기존 시그니처를 유지하므로 호출처 변경 X.

CREATE OR REPLACE FUNCTION redeem_coupon(
  p_coupon_id UUID,
  p_user_id UUID,
  p_order_id UUID
) RETURNS TABLE (ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage_limit INTEGER;
  v_used_count INTEGER;
  v_per_user_limit INTEGER;
  v_user_count INTEGER;
BEGIN
  -- 행 잠금 — 동시 redeem 차단.
  SELECT usage_limit, used_count, per_user_limit
    INTO v_usage_limit, v_used_count, v_per_user_limit
  FROM coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'coupon_not_found';
    RETURN;
  END IF;

  -- 멱등 — 같은 (coupon_id, order_id) 가 있으면 already_redeemed.
  IF EXISTS (
    SELECT 1 FROM coupon_redemptions
    WHERE coupon_id = p_coupon_id AND order_id = p_order_id
  ) THEN
    RETURN QUERY SELECT true, 'already_redeemed';
    RETURN;
  END IF;

  -- 글로벌 한도.
  IF v_usage_limit IS NOT NULL AND v_used_count >= v_usage_limit THEN
    RETURN QUERY SELECT false, '쿠폰이 모두 소진됐어요';
    RETURN;
  END IF;

  -- audit 2-9: 사용자별 한도. row lock 보유 중이라 동시 호출도 직렬화됨.
  IF v_per_user_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_count
    FROM coupon_redemptions
    WHERE coupon_id = p_coupon_id
      AND user_id = p_user_id;

    IF v_user_count >= v_per_user_limit THEN
      RETURN QUERY SELECT false, '이미 사용하신 쿠폰이에요';
      RETURN;
    END IF;
  END IF;

  -- INSERT + used_count++.
  INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, redeemed_at)
  VALUES (p_coupon_id, p_user_id, p_order_id, now());

  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id;

  RETURN QUERY SELECT true, 'redeemed';
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_coupon(UUID, UUID, UUID)
  TO authenticated, service_role;
