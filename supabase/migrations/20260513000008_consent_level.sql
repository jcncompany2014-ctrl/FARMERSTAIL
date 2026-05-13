-- =============================================================================
-- 단계적 동의 4단계 (B-92) + 동의별 포인트 (B-94)
-- =============================================================================
--
-- profiles.consent_level smallint 1~4
-- profiles.consent_max_rewarded_level — 보상 멱등성 (한 번씩만 적립)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_level smallint
    NOT NULL DEFAULT 1
    CHECK (consent_level >= 1 AND consent_level <= 4);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_max_rewarded_level smallint
    NOT NULL DEFAULT 1
    CHECK (consent_max_rewarded_level >= 1 AND consent_max_rewarded_level <= 4);

COMMENT ON COLUMN public.profiles.consent_level IS
  '단계적 동의 1~4: basic/anonymous/academic/b2b.';
COMMENT ON COLUMN public.profiles.consent_max_rewarded_level IS
  '이미 보상 받은 가장 높은 동의 단계. 같은 단계 재적립 차단.';

-- 동의 상승 RPC — 포인트 자동 적립까지 atomic
CREATE OR REPLACE FUNCTION public.set_consent_level(p_level smallint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev smallint;
  v_max_rewarded smallint;
  v_reward integer := 0;
  v_balance integer;
  v_ledger record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '로그인이 필요해요');
  END IF;
  IF p_level < 1 OR p_level > 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', '유효하지 않은 동의 단계예요');
  END IF;

  SELECT consent_level, consent_max_rewarded_level
    INTO v_prev, v_max_rewarded
  FROM public.profiles WHERE id = v_uid;
  IF v_prev IS NULL THEN v_prev := 1; END IF;
  IF v_max_rewarded IS NULL THEN v_max_rewarded := 1; END IF;

  UPDATE public.profiles SET consent_level = p_level WHERE id = v_uid;

  INSERT INTO public.consent_log (
    user_id, channel, granted, policy_version, source
  ) VALUES (
    v_uid, 'consent_level', p_level > 1, 'v1', 'set_consent_level'
  );

  -- 새 단계가 max_rewarded 보다 높을 때만 보상. 각 단계 한 번씩만.
  IF p_level > v_max_rewarded THEN
    -- 단계별 누적 보상 — 2: 500 / 3: +1000 / 4: +2000
    v_reward := 0;
    IF p_level >= 2 AND v_max_rewarded < 2 THEN v_reward := v_reward + 500; END IF;
    IF p_level >= 3 AND v_max_rewarded < 3 THEN v_reward := v_reward + 1000; END IF;
    IF p_level >= 4 AND v_max_rewarded < 4 THEN v_reward := v_reward + 2000; END IF;

    IF v_reward > 0 THEN
      SELECT * INTO v_ledger
      FROM public.apply_point_delta(
        v_uid,
        v_reward,
        format('데이터 동의 단계 %s 응원 포인트', p_level),
        'consent_upgrade',
        NULL
      );
      v_balance := v_ledger.balance_after;
    END IF;

    UPDATE public.profiles
    SET consent_max_rewarded_level = p_level
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prev', v_prev,
    'next', p_level,
    'reward', v_reward,
    'balanceAfter', v_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_consent_level(smallint) TO authenticated;
