-- R39e (#25) — feeding_outcomes 자유 입력 reason_detail 추가.
-- 6개 category enum (not_eating / digestion_issue / weight_change / price /
-- lifestyle / other) 외에 사용자 자유 표현을 캡쳐. 향후 NLP 분석 / 환불
-- 사유 토픽 모델링 input.

ALTER TABLE public.feeding_outcomes
  ADD COLUMN IF NOT EXISTS reason_detail text;

COMMENT ON COLUMN public.feeding_outcomes.reason_detail IS
  '자유 입력 환불/해지 사유. ReasonCategory enum 보완 (R39e).';
