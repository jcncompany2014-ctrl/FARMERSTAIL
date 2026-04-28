-- =============================================================================
-- Atomic points & coupons RPCs — race-safe ledger / redemption.
--
-- # 배경
--
-- 기존 (lib/commerce/points.ts, lib/coupons.ts) 은 두 개의 분리된 SQL 호출로
-- ledger insert / coupon redemption 을 처리했다:
--
--   포인트:
--     1. SELECT balance_after FROM point_ledger ... ORDER BY created_at DESC LIMIT 1
--     2. INSERT INTO point_ledger (..., balance_after = prev + delta)
--
--   쿠폰:
--     1. INSERT INTO coupon_redemptions (...)
--     2. UPDATE coupons SET used_count = used_count + 1 WHERE id = ?
--
-- 두 호출 사이에 다른 동시 요청이 끼어들면:
--   - 같은 잔액을 읽고 중복 차감 → 음수 잔액
--   - 두 redemption 이 동시 insert → usage_limit 초과
--   - INSERT 만 성공하고 UPDATE 실패 → 카운터 부정확
--
-- D2C 규모에선 한 사용자가 동시 결제를 두 번 하는 케이스가 드물어 운 좋게
-- 안 터졌지만, 지갑/쿠폰은 돈과 직결되는 데이터라 안전장치가 반드시 필요.
--
-- # 해결책
--
-- 두 작업을 PL/pgSQL 함수로 묶어 **단일 트랜잭션** 안에서 처리한다.
--
--   - 포인트: `pg_advisory_xact_lock(user_id)` 로 사용자별 직렬화. ledger 의
--     이전 row 가 없을 수 있어 row-level lock 이 어려운 점을 advisory lock 으로
--     우회. lock 은 트랜잭션 종료 시 자동 해제.
--
--   - 쿠폰: `SELECT ... FOR UPDATE` 로 coupons 행 락. INSERT redemption +
--     UPDATE used_count 가 같은 트랜잭션 안에서 원자적으로 처리.
--
-- # 멱등성 인덱스
--
-- 같은 주문에 대해 같은 종류 적립이 두 번 일어나는 버그 (예: 결제 webhook 이
-- 두 번 호출) 를 DB 레벨에서 방어. partial unique index — reference_id 가 NULL
-- 인 메모성 row 는 제외.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) apply_point_delta — 포인트 ledger atomic 추가
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_point_delta(
  p_user_id        UUID,
  p_delta          INTEGER,
  p_reason         TEXT,
  p_reference_type TEXT,
  p_reference_id   UUID
)
RETURNS TABLE(balance_after INTEGER, ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_prev     INTEGER;
  v_next     INTEGER;
BEGIN
  -- 사용자별 advisory lock — 이 트랜잭션 동안 같은 user_id 에 대한 다른
  -- apply_point_delta 호출은 pending. hashtext 로 UUID → BIGINT.
  v_lock_key := hashtext(p_user_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 가장 최근 잔액 조회. row 가 없으면 0 으로 시작.
  SELECT pl.balance_after INTO v_prev
  FROM public.point_ledger pl
  WHERE pl.user_id = p_user_id
  ORDER BY pl.created_at DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    v_prev := 0;
  END IF;

  v_next := v_prev + p_delta;

  -- 음수 잔액 방어 — 호출처가 사전 체크하지만 마지막 방어선.
  IF v_next < 0 THEN
    RETURN QUERY SELECT v_prev, FALSE, '포인트 잔액이 부족해요'::TEXT;
    RETURN;
  END IF;

  -- 멱등성: 같은 (user, reference_type, reference_id) 가 이미 있으면 INSERT
  -- 가 unique 제약에 걸리는데 (아래 partial index), exception 을 잡고 기존
  -- 잔액을 그대로 반환 → 호출처는 "이미 처리됨" 으로 인식.
  BEGIN
    INSERT INTO public.point_ledger (
      user_id, delta, balance_after, reason, reference_type, reference_id
    ) VALUES (
      p_user_id, p_delta, v_next, p_reason, p_reference_type, p_reference_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT v_prev, TRUE, 'already_applied'::TEXT;
      RETURN;
  END;

  RETURN QUERY SELECT v_next, TRUE, NULL::TEXT;
END;
$$;

-- 멱등성 partial unique index — 같은 reference 에 대해 두 번 적립/차감 불가.
-- reference_id 가 NULL 인 admin_adjustment 같은 메모성 row 는 영향 없음.
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_ledger_reference
  ON public.point_ledger (user_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- 권한: 인증된 유저만 호출. 함수는 본인 user_id 로만 ledger 조작 — 호출처가
-- 항상 auth.uid() 와 일치하는 user_id 로 호출하도록 강제할 수도 있지만,
-- service_role 에서는 다른 user 의 ledger 도 만질 수 있어야 하므로 (관리자
-- 보정, 환불 등) 함수 자체는 user_id 를 인자로 받는다. 호출 권한만 제한.
REVOKE ALL ON FUNCTION public.apply_point_delta(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_point_delta(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_point_delta IS
  'Atomic point ledger insert with per-user advisory lock and idempotency on (user_id, reference_type, reference_id).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) redeem_coupon — 쿠폰 사용 (redemption insert + used_count++) atomic
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_coupon_id UUID,
  p_user_id   UUID,
  p_order_id  UUID
)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used_count   INTEGER;
  v_usage_limit  INTEGER;
BEGIN
  -- 행 잠금 — 다른 동시 redeem_coupon 은 이 행에서 대기.
  SELECT c.used_count, c.usage_limit
    INTO v_used_count, v_usage_limit
  FROM public.coupons c
  WHERE c.id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '존재하지 않는 쿠폰이에요'::TEXT;
    RETURN;
  END IF;

  -- 소진 체크 — 락 안에서 다시 검증 (validate 호출 후 다른 사용자가 쓸 수 있음).
  IF v_usage_limit IS NOT NULL AND v_used_count >= v_usage_limit THEN
    RETURN QUERY SELECT FALSE, '쿠폰이 모두 소진됐어요'::TEXT;
    RETURN;
  END IF;

  -- redemption 기록 + 카운터 증가 (같은 트랜잭션). 같은 (coupon_id, order_id)
  -- 가 이미 있으면 멱등 처리 — webhook 두 번 들어와도 한 번만 적용.
  BEGIN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id)
    VALUES (p_coupon_id, p_user_id, p_order_id);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT TRUE, 'already_redeemed'::TEXT;
      RETURN;
  END;

  UPDATE public.coupons
     SET used_count = used_count + 1
   WHERE id = p_coupon_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

-- 멱등성: 같은 주문에 같은 쿠폰을 두 번 적용 못 하게.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_order
  ON public.coupon_redemptions (coupon_id, order_id);

REVOKE ALL ON FUNCTION public.redeem_coupon(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.redeem_coupon IS
  'Atomic coupon redemption: row-level lock on coupons, idempotent on (coupon_id, order_id).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) revoke_coupon_redemption — 주문 취소 시 카운터 -1 (atomic)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_coupon_redemption(
  p_coupon_code TEXT
)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.coupons
  WHERE code = p_coupon_code
  FOR UPDATE;

  IF NOT FOUND THEN
    -- 존재하지 않는 쿠폰은 ok 처리 — 삭제된 쿠폰일 수 있음.
    RETURN QUERY SELECT TRUE, 'no_such_coupon'::TEXT;
    RETURN;
  END IF;

  UPDATE public.coupons
     SET used_count = GREATEST(0, used_count - 1)
   WHERE id = v_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_coupon_redemption(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_coupon_redemption(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.revoke_coupon_redemption IS
  'Atomic coupon counter decrement (used_count -= 1) with row-level lock and underflow guard.';
