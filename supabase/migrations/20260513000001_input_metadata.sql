-- 발명 모듈 A — 다차원 입력 메타데이터.
--
-- dogs 테이블에 측정 도구 메타데이터 3개 + 측정 일자 컬럼 추가. 각 측정값의
-- 신뢰도를 변수별로 산출하기 위함. CHECK 제약 + DEFAULT 'unknown' 으로
-- 기존 데이터 안전 (NULL X, 사용자가 입력 안 해도 'unknown' 으로 동작).
--
-- voice-guidelines §7 — "모름" 옵션 항상. 사용자가 측정 도구를 모르거나
-- 기록 안 했으면 'unknown' 선택 가능 (신뢰도는 낮아지지만 시스템은 작동).

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS weight_method text NOT NULL DEFAULT 'unknown'
  CHECK (weight_method IN (
    'vet_scale',      -- 동물병원 체중계 (정확도 1.0)
    'home_digital',   -- 가정용 디지털 (0.9)
    'home_analog',    -- 가정용 아날로그 (0.7)
    'hold',           -- 안고 재기 (0.6)
    'eyeball',        -- 육안 추정 (0.4)
    'unknown'         -- 모름 (0.3)
  ));

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS activity_method text NOT NULL DEFAULT 'unknown'
  CHECK (activity_method IN (
    'pedometer',      -- 만보계/스마트태그 (0.95)
    'gps',            -- GPS 트래커 (0.95)
    'subjective',     -- 주관 추정 (0.5)
    'unknown'         -- 모름 (0.4)
  ));

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS feed_method text NOT NULL DEFAULT 'unknown'
  CHECK (feed_method IN (
    'auto_delivery',  -- 자체 사료 자동 추적 (1.0 — 발명 모듈 A 핵심)
    'scale',          -- 저울 (0.95)
    'cup',            -- 계량컵 (0.7)
    'eyeball',        -- 눈대중 (0.4)
    'unknown'         -- 모름 (0.3)
  ));

-- 마지막 체중 측정 일자 — 최근성 (W_recency) 산출용.
-- 1주 이내 1.0, 1개월 이내 0.85, 3개월 이내 0.6 등 시간 경과 시 감점.
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS weight_measured_at timestamptz;

-- 알러지 출처 — 자가 의심 vs 수의사 진단 분리 (voice-guidelines §11).
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS allergies_source text DEFAULT 'self_suspected'
  CHECK (allergies_source IN ('self_suspected', 'vet_diagnosed', 'unknown'));

COMMENT ON COLUMN public.dogs.weight_method IS
  '체중 측정 도구. 발명 모듈 A. 신뢰도 점수의 W_method 입력.';
COMMENT ON COLUMN public.dogs.activity_method IS
  '활동량 측정 도구. 발명 모듈 A.';
COMMENT ON COLUMN public.dogs.feed_method IS
  '급여량 측정 도구. auto_delivery=자체 사료 자동 추적 (1.0).';
COMMENT ON COLUMN public.dogs.weight_measured_at IS
  '마지막 체중 측정 일자. W_recency 산출용 (1주 이내 1.0).';
COMMENT ON COLUMN public.dogs.allergies_source IS
  '알러지 출처 — self_suspected (자가 의심) / vet_diagnosed (수의사 진단).';
