-- =============================================================================
-- 사용자 자율성 — 변수별 측정도구 잠금 (R32, voice-guidelines §9, 42 deferred #20)
-- =============================================================================
--
-- 견주가 "이 변수는 현재 측정도구로 충분해요" 라고 명시할 수 있게 한다.
-- 잠금된 변수는 시스템이 더 이상 도구 개선 권유(push, nudge, hint)를 보내지
-- 않는다. 신뢰도 점수 산출은 그대로 진행 (낮은 채로) — 사용자 자율 결정.
--
-- 발명 명세 모듈 G "능동 개입" 의 부정적 case 우선 가드. 견주가 거부 의사를
-- 한 번 표명하면 시스템 잡음을 줄여 신뢰감을 유지한다.
--
-- 컬럼 형식:
--   user_method_lock JSONB DEFAULT '{}'::jsonb
--   예: {"weight": true, "activity": false, "feed": true}
--   - 키: 'weight' | 'activity' | 'feed' (reliability variable key)
--   - 값: boolean (true = lock = 권유 X)
--   - 키 누락 / null = lock 해제 (default 행동)
--
-- 정책:
--   · accuracy_user_boost 는 score boost (+0.15), user_method_lock 은 행동
--     제어 (push 발송 가드). 둘은 독립적. 같이 켜도 자연스럽게 함께 작동.
--   · JSONB 라 향후 변수 추가 시 schema migration 없이 확장 가능.
-- =============================================================================

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS user_method_lock jsonb
    NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.dogs.user_method_lock IS
  '변수별 측정도구 잠금. {"weight":true} 면 체중 변수 권유 push/nudge skip. voice-guidelines §9.';

-- RLS: dogs 테이블 기존 정책이 user_id 매칭 강제. 별도 정책 추가 X.
