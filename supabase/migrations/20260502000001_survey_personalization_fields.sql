-- ============================================================================
-- Migration: surveys personalization fields — 화식 비율 알고리즘 1차 input
-- ============================================================================
--
-- 배경
-- ----
-- 5종 화식 라인업 (Basic 닭 / Weight 오리 / Skin 연어 / Premium 소 / Joint 돼지)
-- + 동결건조 토퍼를 강아지별 비율로 조합하는 personalization 시스템에서, 첫
-- 박스 결정 알고리즘이 가장 중요하게 보는 변수는 보호자의 "케어 목표"다.
-- 기존 설문은 임상 평가 (BCS/MCS/Bristol/만성질환) 에 충실하지만, 의도/목표
-- 신호가 없어 알고리즘이 "5kg 시바, 7세, 정상 BCS, 알레르기 없음" 같은 평범한
-- 케이스에서 5종 중 어느 라인이 메인이어야 하는지 결정 못 한다.
--
-- 본 마이그레이션이 추가하는 7개 필드:
--
--   🔴 Critical (알고리즘 첫 박스 결정 필수)
--     1. care_goal              — 보호자의 메인 케어 목표 (1순위 변수)
--     2. home_cooking_experience — 화식 첫 도입 여부 (전환기 보수성 결정)
--     3. current_diet_satisfaction — 1-5 만족도 (4주차 비교 baseline)
--
--   🟡 Improves (정확도 향상)
--     4. weight_trend_6mo  — BCS 가 "현재" 라면 trend 는 "변화 방향"
--     5. gi_sensitivity    — 사료 변경 시 변 무름 빈도 → 단일/혼합 결정
--     6. preferred_proteins — 알레르기 외 강아지 기호 (거부율 ↓)
--     7. indoor_activity   — 산책 외 실내 활동 (칼로리 인자 fine-tune)
--
-- 모든 컬럼 nullable — 기존 데이터/v1 설문 호환. 단 client UI 는 Critical 3개
-- 를 필수로 받음 (DB level 은 NULL 허용해 history 데이터 마이그 부담 ZERO).
-- ============================================================================

BEGIN;

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS care_goal text
    CHECK (care_goal IS NULL OR care_goal IN (
      'weight_management',  -- 체중 관리 (감량/유지/증량)
      'skin_coat',          -- 피부·털 개선
      'joint_senior',       -- 관절·시니어 케어
      'allergy_avoid',      -- 알레르기·민감 회피
      'general_upgrade'     -- 일반 영양 업그레이드
    )),
  ADD COLUMN IF NOT EXISTS home_cooking_experience text
    CHECK (home_cooking_experience IS NULL OR home_cooking_experience IN (
      'first',       -- 처음 — 4주 전환기 protocol 적용
      'occasional',  -- 가끔 — 점진 전환
      'frequent'     -- 자주/매일 — full ratio 즉시
    )),
  ADD COLUMN IF NOT EXISTS current_diet_satisfaction smallint
    CHECK (current_diet_satisfaction IS NULL OR
           (current_diet_satisfaction BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS weight_trend_6mo text
    CHECK (weight_trend_6mo IS NULL OR weight_trend_6mo IN (
      'stable', 'gained', 'lost', 'unknown'
    )),
  ADD COLUMN IF NOT EXISTS gi_sensitivity text
    CHECK (gi_sensitivity IS NULL OR gi_sensitivity IN (
      'rare',       -- 거의 없음 — 혼합 OK
      'sometimes',  -- 가끔
      'frequent',   -- 자주 — 보수적 (단일 단백질 우선)
      'always'      -- 매번 — 단일 100% 시작
    )),
  ADD COLUMN IF NOT EXISTS preferred_proteins text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS indoor_activity text
    CHECK (indoor_activity IS NULL OR indoor_activity IN (
      'calm',     -- 차분 (실내 휴식 위주)
      'moderate', -- 보통
      'active'    -- 활발 (실내 뛰놀기 자주)
    ));

COMMENT ON COLUMN public.surveys.care_goal IS
  '보호자가 선택한 메인 케어 목표. 알고리즘 첫 박스 SKU 메인 라인 결정의
   1순위 변수. 5개 값이 5종 라인업과 1:1 매칭되도록 설계됨.';

COMMENT ON COLUMN public.surveys.home_cooking_experience IS
  '화식 경험 정도. ''first'' 인 경우 첫 박스를 max 80/20 단순 조합으로 보수적
   구성하고, 토퍼는 4주 전환기 후 추가. ''frequent'' 면 full ratio 즉시 적용.';

COMMENT ON COLUMN public.surveys.current_diet_satisfaction IS
  '1(매우 불만) ~ 5(매우 만족). 4주차 체크인 응답과의 비교 baseline. 만족도
   5인 경우 알고리즘이 적극 조정을 회피해 churn 방지.';

COMMENT ON COLUMN public.surveys.weight_trend_6mo IS
  '최근 6개월 체중 추세. BCS 가 "현재" 라면 trend 는 "변화 방향". 의도된
   감량인지 우려 신호인지 알아야 정확한 칼로리 처방 가능.';

COMMENT ON COLUMN public.surveys.gi_sensitivity IS
  '사료 변경 시 변 무름 빈도. ''frequent''/''always'' 인 경우 첫 박스를 단일
   단백질 위주 + 토퍼 최소로 시작해 위장 적응기 부담 최소화.';

COMMENT ON COLUMN public.surveys.preferred_proteins IS
  '보호자가 알고 있는 강아지 기호 단백질 (알레르기와 별개). 값 도메인:
   chicken / beef / salmon / pork / lamb / duck. 알레르기 제외 후 선호 단백질을
   메인 라인 우선순위에 가산점.';

COMMENT ON COLUMN public.surveys.indoor_activity IS
  '산책 외 실내 활동 수준. dogs.activity_level (3-tier) + daily_walk_minutes
   와 합쳐 칼로리 인자 fine-tune 에 사용.';

-- 케어 목표 빈도 분석 — admin 운영 인사이트 + 라인업 수요 예측에 사용.
CREATE INDEX IF NOT EXISTS surveys_care_goal_idx
  ON public.surveys (care_goal)
  WHERE care_goal IS NOT NULL;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (참고)
-- ============================================================================
-- 1) 새 컬럼 생성 확인:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='surveys'
--      AND column_name IN (
--        'care_goal','home_cooking_experience','current_diet_satisfaction',
--        'weight_trend_6mo','gi_sensitivity','preferred_proteins','indoor_activity'
--      );
--
-- 2) CHECK 제약 시도 — 잘못된 값 reject 확인:
--    INSERT INTO surveys (... care_goal) VALUES (..., 'INVALID');
--    → ERROR: new row violates check constraint
--
-- 3) 케어 목표 분포 (운영 후):
--    SELECT care_goal, count(*)
--    FROM surveys
--    WHERE care_goal IS NOT NULL
--    GROUP BY care_goal
--    ORDER BY count(*) DESC;
