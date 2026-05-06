-- ============================================================================
-- Migration: hot path 인덱스 보강 (강아지별 분석 / 설문 / cycle 조회)
-- ============================================================================
--
-- 배경
--  강아지 상세 / 분석 리스트 / cycle 진행 cron 등 핫패스에서 (dog_id,
--  created_at|cycle_number) 복합 정렬이 빈번한데 적절한 복합 인덱스 부재.
--  단일 컬럼 인덱스만으로 sort 단계에서 cost 발생.
--
-- 변경
--  · analyses_dog_created_idx — 강아지별 분석 history (analyses 페이지)
--  · analyses_user_created_idx — 마이페이지 분석 list
--  · dog_formulas_dog_cycle_idx — 강아지 상세 / 분석 후 처방 fetch
--  · surveys_dog_created_idx — 강아지별 최신 설문 (compute API)
--  · dog_checkins_dog_cycle_idx — 체크인 응답 fetch (cron + 분석)
-- ============================================================================

CREATE INDEX IF NOT EXISTS analyses_dog_created_idx
  ON public.analyses (dog_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analyses_user_created_idx
  ON public.analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dog_formulas_dog_cycle_idx
  ON public.dog_formulas (dog_id, cycle_number DESC);

CREATE INDEX IF NOT EXISTS surveys_dog_created_idx
  ON public.surveys (dog_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dog_checkins_dog_cycle_idx
  ON public.dog_checkins (dog_id, cycle_number DESC);
