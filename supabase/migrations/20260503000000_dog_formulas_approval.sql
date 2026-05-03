-- ============================================================================
-- Migration: dog_formulas — approval flow (Option A, 사용자 동의 우회)
-- ============================================================================
--
-- 배경
-- ----
-- Option A (subscription thin wrapper) 의 핵심 — formula 변경은 보호자 명시적
-- 동의 후에만 적용. 한국 전자상거래법 §13의2 ("가격/구성 변경 시 사전 동의") 우회.
--
-- 흐름:
--   1. cron 이 cycle 만료 시 새 formula 계산 (의미 있는 변화 vs 미세 조정)
--   2. 미세 조정 → status='auto_applied' (기존 동작)
--   3. 의미 있는 변화 → status='pending_approval' + push/email
--   4. 사용자 응답: approve / decline / 무응답 (5일 후 자동 declined)
--   5. 결제일에 status='approved' 또는 'auto_applied' formula 사용
--
-- 새 컬럼:
--   - approval_status: 'auto_applied' | 'pending_approval' | 'approved' | 'declined'
--   - approved_at:     사용자가 approve 한 시각 (또는 auto_applied 시각)
--   - proposed_at:     pending_approval 로 만들어진 시각 (timeout 계산용)
--
-- 모든 컬럼 nullable + DEFAULT 'auto_applied' — 기존 row 영향 ZERO.
-- ============================================================================

BEGIN;

ALTER TABLE public.dog_formulas
  ADD COLUMN IF NOT EXISTS approval_status text
    NOT NULL DEFAULT 'auto_applied'
    CHECK (approval_status IN (
      'auto_applied',     -- 미세 조정. 즉시 적용 (default).
      'pending_approval', -- 의미 있는 변화. 사용자 응답 대기.
      'approved',         -- 사용자가 approve. 결제일에 적용.
      'declined'          -- 사용자 declined 또는 5일 timeout. 이전 formula 유지.
    )),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz;

COMMENT ON COLUMN public.dog_formulas.approval_status IS
  'Option A 동의 흐름. 미세 조정은 auto_applied (기존 동작). 의미 있는 변화
   (라인 ±10%+, 라인 추가/제거, 알레르기 변경 등) 는 pending_approval 로
   생성되고 사용자 응답 후 approved/declined.';

COMMENT ON COLUMN public.dog_formulas.approved_at IS
  '사용자 approve 시각, 또는 auto_applied 의 적용 시각. NULL = 아직 응답 없음.';

COMMENT ON COLUMN public.dog_formulas.proposed_at IS
  'pending_approval 시작 시각. cron 이 이 시점 + 5일 지나면 자동 declined.';

-- 기존 row 들 (마이그 전) 은 모두 'auto_applied' default 로 마킹됨. approved_at
-- 은 created_at 으로 backfill — 그냥 적용된 것으로 간주.
UPDATE public.dog_formulas
SET approved_at = created_at
WHERE approved_at IS NULL AND approval_status = 'auto_applied';

-- 인덱스 — pending 만 빠르게 조회 (approval timeout cron + admin).
CREATE INDEX IF NOT EXISTS dog_formulas_pending_idx
  ON public.dog_formulas (proposed_at)
  WHERE approval_status = 'pending_approval';

CREATE INDEX IF NOT EXISTS dog_formulas_approved_idx
  ON public.dog_formulas (dog_id, approved_at DESC)
  WHERE approval_status IN ('auto_applied', 'approved');

COMMIT;

-- ============================================================================
-- 검증 쿼리 (참고)
-- ============================================================================
-- 1) 컬럼 추가 확인:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='dog_formulas'
--      AND column_name IN ('approval_status', 'approved_at', 'proposed_at');
--
-- 2) 기존 row 모두 auto_applied:
--    SELECT approval_status, count(*) FROM dog_formulas GROUP BY approval_status;
--
-- 3) pending 큐 크기 (운영 후):
--    SELECT count(*) FROM dog_formulas
--    WHERE approval_status='pending_approval'
--      AND proposed_at < now() - interval '5 days';
