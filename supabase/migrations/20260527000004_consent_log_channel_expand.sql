-- ─────────────────────────────────────────────────────────────────────────────
-- consent_log.channel CHECK constraint 확장 (R82-G3 PIPA Critical fix)
--
-- 문제:
--   migration 20260424000005 가 channel CHECK (email|sms) 만 허용.
--   migration 20260513000008 의 set_consent_level RPC 가 channel='consent_level'
--   insert 시도 → check_violation throw → 단계적 동의 RPC 전체 트랜잭션 rollback.
--   사용자가 /mypage/privacy 의 ConsentLevelCard 동의 단계 변경 시 매번 실패.
--
-- Fix:
--   CHECK 확장 — 'consent_level' + 'newsletter' 추가.
--   RPC schema (set_consent_level + /api/consent/unsubscribe-ack) 가 사용하는
--   모든 channel value 와 일치.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.consent_log
  DROP CONSTRAINT IF EXISTS consent_log_channel_check;

ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_channel_check
  CHECK (channel IN ('email', 'sms', 'consent_level', 'newsletter'));
