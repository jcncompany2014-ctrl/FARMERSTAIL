-- ============================================================================
-- Migration: referral milestone 보상 발급 인프라
-- ============================================================================
--
-- # 배경
-- /mypage/referral 의 milestone UI (1/5/10/20명) 가 시각화만 있고 실제
-- 보상 발급 로직 없었음. 이제 cron 이 매일 1회 실행되며:
--  - 1명 — 즉시 (이미 구현, redeem_referral_code RPC)
--  - 5명 — 5,000원 쿠폰 (per_user_limit=1)
--  - 10명 — 10,000원 쿠폰
--  - 20명 — 1개월 정기배송 무료 (50,000P 적립금으로 대체)
--
-- # 구조
-- 1. referral_milestone_rewards 테이블 — (user_id, milestone) 페어로 멱등 발급
--    한 사용자가 같은 milestone 보상을 여러 번 받지 않게.
-- 2. issue_referral_milestones() RPC — 모든 사용자 referral 카운트 점검 후
--    도달한 milestone 에 대해 보상 발급. cron 이 호출.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referral_milestone_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  milestone smallint NOT NULL CHECK (milestone IN (5, 10, 20)),
  /** 발급된 보상 종류 — 쿠폰이면 coupon_code, 적립금이면 'points'. */
  reward_type text NOT NULL CHECK (reward_type IN ('coupon', 'points')),
  /** 발급된 쿠폰 코드 (reward_type='coupon' 일 때) 또는 적립 금액 (points). */
  reward_value text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_milestone_unique UNIQUE (user_id, milestone)
);

CREATE INDEX IF NOT EXISTS referral_milestone_user_idx
  ON public.referral_milestone_rewards (user_id, granted_at DESC);

ALTER TABLE public.referral_milestone_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rmr_select_own ON public.referral_milestone_rewards;
CREATE POLICY rmr_select_own ON public.referral_milestone_rewards
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.referral_milestone_rewards IS
  '친구 초대 milestone 보상 발급 audit. (user_id, milestone) 페어로 멱등.';

-- ── milestone 보상 RPC ────────────────────────────────────────────────────
-- 모든 사용자의 referral 카운트 + 미발급 milestone 점검 → 보상 발급.
-- cron 이 매일 1회 호출. 새로 발급된 row 수를 반환.
CREATE OR REPLACE FUNCTION public.issue_referral_milestones()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user record;
  v_referred_count int;
  v_granted int := 0;
  v_milestone smallint;
  v_balance int;
BEGIN
  -- 사용자별 referral 카운트 합산. 1명 이상 초대한 사용자만 처리.
  FOR v_user IN
    SELECT referrer_id AS user_id, COUNT(*)::int AS cnt
    FROM public.referral_redemptions
    GROUP BY referrer_id
    HAVING COUNT(*) >= 5
  LOOP
    v_referred_count := v_user.cnt;

    -- 도달한 milestone 들 — 5, 10, 20. 미발급인 것만.
    FOR v_milestone IN
      SELECT m FROM (VALUES (5::smallint), (10::smallint), (20::smallint)) t(m)
      WHERE m <= v_referred_count
    LOOP
      -- 이미 발급됐으면 skip (UNIQUE 제약으로 자연 차단되지만 미리 체크).
      IF EXISTS (
        SELECT 1 FROM public.referral_milestone_rewards
        WHERE user_id = v_user.user_id AND milestone = v_milestone
      ) THEN
        CONTINUE;
      END IF;

      -- milestone 별 보상 발급
      IF v_milestone = 5 THEN
        -- 5,000원 적립금
        SELECT COALESCE(
          (SELECT balance_after FROM public.point_ledger
            WHERE user_id = v_user.user_id
            ORDER BY created_at DESC LIMIT 1), 0
        ) + 5000
          INTO v_balance;
        INSERT INTO public.point_ledger
          (user_id, delta, balance_after, reason, reference_type, reference_id)
        VALUES (
          v_user.user_id,
          5000,
          v_balance,
          '친구 5명 초대 달성 보상',
          'referral_milestone',
          NULL
        );
        INSERT INTO public.referral_milestone_rewards
          (user_id, milestone, reward_type, reward_value)
        VALUES (v_user.user_id, 5, 'points', '5000');

      ELSIF v_milestone = 10 THEN
        -- 10,000원 적립금
        SELECT COALESCE(
          (SELECT balance_after FROM public.point_ledger
            WHERE user_id = v_user.user_id
            ORDER BY created_at DESC LIMIT 1), 0
        ) + 10000
          INTO v_balance;
        INSERT INTO public.point_ledger
          (user_id, delta, balance_after, reason, reference_type, reference_id)
        VALUES (
          v_user.user_id,
          10000,
          v_balance,
          '친구 10명 초대 달성 보상',
          'referral_milestone',
          NULL
        );
        INSERT INTO public.referral_milestone_rewards
          (user_id, milestone, reward_type, reward_value)
        VALUES (v_user.user_id, 10, 'points', '10000');

      ELSIF v_milestone = 20 THEN
        -- 50,000원 적립금 (1개월 정기배송 무료 등가 — 솔로 운영 단계 단순화).
        SELECT COALESCE(
          (SELECT balance_after FROM public.point_ledger
            WHERE user_id = v_user.user_id
            ORDER BY created_at DESC LIMIT 1), 0
        ) + 50000
          INTO v_balance;
        INSERT INTO public.point_ledger
          (user_id, delta, balance_after, reason, reference_type, reference_id)
        VALUES (
          v_user.user_id,
          50000,
          v_balance,
          '친구 20명 초대 달성 보상 (1개월 정기배송 등가)',
          'referral_milestone',
          NULL
        );
        INSERT INTO public.referral_milestone_rewards
          (user_id, milestone, reward_type, reward_value)
        VALUES (v_user.user_id, 20, 'points', '50000');
      END IF;

      v_granted := v_granted + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('granted', v_granted);
END;
$$;

COMMENT ON FUNCTION public.issue_referral_milestones IS
  '친구 초대 milestone (5/10/20) 도달 시 보상 발급. cron 이 매일 호출. 멱등.';

REVOKE ALL ON FUNCTION public.issue_referral_milestones FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_referral_milestones TO service_role;
