-- ============================================================================
-- Migration: billing retry classification — permanent vs transient 분기
-- ============================================================================
--
-- # 배경
-- 현재 정기배송 cron 은 Toss 결제 실패 시 무조건 failed_charge_count 증가
-- 하다가 3회 누적되면 paused. 결과:
--   1) 카드 만료 (EXPIRED_CARD) 처럼 "절대 retry 해도 안 되는" 에러도 3일을
--      기다린 후에야 일시중단 → 사용자가 3번 동일 실패 메일 받음.
--   2) 일시적 잔액 부족 (INSUFFICIENT_BALANCE) 인데 같은 날 cron 이 한 번만
--      도니까 retry 기회 없음. 다음 날 자동 retry 되지만 그 사이 다른 카드로
--      바로 retry 할 수 있는 경로 없음.
--   3) UI 에서 "카드 재등록 필요" 와 "잠시 대기" 가 구분 안 됨 — 같은 paused.
--
-- # 컬럼 추가
-- - `requires_billing_key_renewal` — Toss 가 영구 거절 (카드 만료/잘못된 카드)
--   한 경우 true. paused 와 별개로 마이페이지에서 "카드 다시 등록" CTA 표시.
-- - `next_retry_at` — 일시 실패 (잔액 부족 / 네트워크) 시 24h 후로 설정.
--   cron 은 next_retry_at > NOW() 이면 해당 row 를 skip.
-- - `last_failed_charge_code` — Toss 에러 코드 (vs 한국어 메시지 reason).
--   admin 대시보드에서 분류·알람 룰 만들 때 필요.
--
-- # 인덱스
-- 기존 cron query 가 status='active' AND next_delivery_date <= today.
-- next_retry_at 필터를 추가하므로 partial index 로 hot path 를 커버.
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS requires_billing_key_renewal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_charge_code text;

-- next_retry_at hot path: active 중에서 retry 대기 중인 row 빠르게 skip.
CREATE INDEX IF NOT EXISTS subscriptions_active_due_idx
  ON public.subscriptions (next_delivery_date)
  WHERE status = 'active' AND billing_key IS NOT NULL;

-- requires_billing_key_renewal 사용자 대시보드 hot path — 마이페이지에서
-- "카드 재등록 필요" 배너 표시할 때 user_id 별 한두 row 라 굳이 인덱스 불필요.
-- (subscriptions_user_idx 가 이미 user_id 커버)

COMMENT ON COLUMN public.subscriptions.requires_billing_key_renewal IS
  '카드 만료 등 영구 거절 시 true. 사용자가 /subscribe/billing-auth 에서 재발급 시 false 로 reset.';
COMMENT ON COLUMN public.subscriptions.next_retry_at IS
  '일시 실패 후 다음 retry 가능 시각. cron 이 이 시각 이전엔 skip.';
COMMENT ON COLUMN public.subscriptions.last_failed_charge_code IS
  'Toss 에러 코드 (예: EXPIRED_CARD, INSUFFICIENT_BALANCE). 분류·알람 룰용.';
