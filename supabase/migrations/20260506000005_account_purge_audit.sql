-- ============================================================================
-- Migration: account_deletions.purged_at + 5년 보관 cron audit
-- ============================================================================
--
-- # 배경
-- /api/cron/account-purge 가 5년 경과한 탈퇴 계정의 transaction 데이터를
-- hard-delete. account_deletions audit row 는 email_hash 만 보존하고
-- purged_at 으로 hard-delete 시점을 표시.
-- ============================================================================

ALTER TABLE public.account_deletions
  ADD COLUMN IF NOT EXISTS purged_at timestamptz;

CREATE INDEX IF NOT EXISTS account_deletions_purged_idx
  ON public.account_deletions (purged_at)
  WHERE purged_at IS NULL;

COMMENT ON COLUMN public.account_deletions.purged_at IS
  '5년 보관 후 hard-delete 시점. NULL = 아직 transaction 데이터 보유.';
