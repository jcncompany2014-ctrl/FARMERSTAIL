-- Phase 1-4 (2026-05-20): feeding_outcomes 테이블 — 사용자 부담 0 outcome 자동 추적.
--
-- 이전 Phase 1 작업에서 lib/feeding-outcomes.ts 와 cron / API route 는 작성했으나
-- 실제 migration 파일이 누락됐던 것을 보강. IF NOT EXISTS 로 idempotent.
--
-- source 분류:
--   first_order          — 첫 박스 시점 baseline (cron/order confirm 자동)
--   first_box_checkin    — 도착 7일 후 1문항 응답 (강제 X)
--   box_rating           — 정기구독 박스 별점 1문항 (강제 X)
--   reorder              — 재주문 시 자동 (LTV 추적)
--   subscription_pause   — 정기구독 일시정지 (사유 동반)
--   subscription_cancel  — 정기구독 해지 (사유 동반)
--   refund               — 환불 (사유 동반)
--   self_log             — 자발 입력 (체중·변·사진)
--
-- cohort_id (운영 정책 — lib/feeding-outcomes.ts:getCurrentCohort):
--   closed_beta_2026_q3  — 출시 전 30두 베타
--   launch_2026_10       — 정식 출시 첫 100건
--   rolling              — 그 이후 default

CREATE TABLE IF NOT EXISTS feeding_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID NOT NULL,
  user_id UUID NOT NULL,
  cohort_id TEXT NOT NULL DEFAULT 'rolling',
  source TEXT NOT NULL CHECK (
    source IN (
      'first_order',
      'first_box_checkin',
      'box_rating',
      'reorder',
      'subscription_pause',
      'subscription_cancel',
      'refund',
      'self_log'
    )
  ),
  -- 정기구독 N번째 박스 (1=첫 박스). reorder/rating 에서 코호트 비교에 사용.
  week_no INTEGER,
  -- 첫 박스 체크인 (1문항 :  👍/😐/👎)
  palatability TEXT CHECK (palatability IS NULL OR palatability IN ('great', 'ok', 'poor')),
  -- 별점 1-5
  rating_stars SMALLINT CHECK (rating_stars IS NULL OR rating_stars BETWEEN 1 AND 5),
  -- Bristol 변형 1-7
  bristol_score SMALLINT CHECK (bristol_score IS NULL OR bristol_score BETWEEN 1 AND 7),
  -- 자발 입력 체중
  weight_kg NUMERIC(5, 2),
  -- BCS 1-9 (WSAVA)
  bcs_score SMALLINT CHECK (bcs_score IS NULL OR bcs_score BETWEEN 1 AND 9),
  -- 환불/해지 사유 분류 (palatability / digestibility / outcome 신호)
  reason_category TEXT CHECK (reason_category IS NULL OR reason_category IN (
    'not_eating',        -- palatability
    'digestion_issue',   -- digestibility
    'weight_change',     -- outcome
    'price',
    'lifestyle',
    'other'
  )),
  sku_code TEXT,
  comment TEXT,
  photo_url TEXT,
  order_id UUID,
  subscription_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feeding_outcomes_dog_fk
    FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE,
  CONSTRAINT feeding_outcomes_user_fk
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 인덱스:
-- (dog_id, source) — first_box_checkin / box_rating 멱등 검사
-- (cohort_id, source) — admin 대시보드 카드 쿼리
-- (created_at DESC) — 시계열 차트
-- (sku_code, source) — SKU별 cohort 비교 매트릭스
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_dog_source
  ON feeding_outcomes (dog_id, source);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_cohort_source
  ON feeding_outcomes (cohort_id, source);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_created_at
  ON feeding_outcomes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_sku_source
  ON feeding_outcomes (sku_code, source)
  WHERE sku_code IS NOT NULL;

-- first_box_checkin 은 강아지 1마리당 1회만. cron 재푸시 방지 (app/api/cron/first-box-checkin/route.ts).
CREATE UNIQUE INDEX IF NOT EXISTS uq_feeding_outcomes_first_checkin
  ON feeding_outcomes (dog_id)
  WHERE source = 'first_box_checkin';

-- RLS — 본인 outcome 만 r/w, admin 은 별도 정책으로 전체 select.
ALTER TABLE feeding_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feeding_outcomes_select_self ON feeding_outcomes;
CREATE POLICY feeding_outcomes_select_self
  ON feeding_outcomes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS feeding_outcomes_insert_self ON feeding_outcomes;
CREATE POLICY feeding_outcomes_insert_self
  ON feeding_outcomes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- admin (profiles.role='admin' or auth.users.app_metadata->>role='admin')
-- 은 별도 함수로 판정. 본 정책은 service_role 만 전체 접근 — admin 대시보드는
-- service_role 클라이언트(createAdminClient)로 쿼리.
-- (lib/auth/admin.ts isAdmin 가드 + service_role 으로 RLS 우회 — 기존 패턴)

COMMENT ON TABLE feeding_outcomes IS
  'Phase 1-4 (2026-05-20): 사용자 부담 0 outcome 자동 추적. cohort_id 별 그룹 → admin 대시보드.';
