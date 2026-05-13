-- =============================================================================
-- 사용자 자율성 — 맞춤도 자기 표명 (사용자 A-20)
-- =============================================================================
--
-- 시스템이 일방적으로 신뢰도를 결정하지 않고, 사용자가 "내 측정은 정확해요"
-- 또는 "내 활동량 추정은 잘 안다" 같은 자기 표명을 통해 자기 데이터의
-- 신뢰도를 직접 boost 할 수 있게 한다. User Sovereignty 원칙.
--
-- 정책:
--  · accuracy_user_boost 는 0~0.2 사이. 너무 크면 객관 측정값을 무력화.
--  · overallReliability 산출 시 합산 → 단, 최종 점수는 [0, 1] clamp.
--  · 사용자가 직접 측정 도구를 점검·교체했을 때 한 번 +0.15 boost 같은
--    micro 행동도 가능.
-- =============================================================================

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS accuracy_user_boost numeric(3,2)
    NOT NULL DEFAULT 0
    CHECK (accuracy_user_boost >= 0 AND accuracy_user_boost <= 0.2);

COMMENT ON COLUMN public.dogs.accuracy_user_boost IS
  '사용자 자기 표명 boost. overallReliability 에 합산. 0~0.2 범위.';
