-- =============================================================================
-- 외부 서비스 연동 — Tractive 등 OAuth 기반 (R33, 42 deferred #1)
-- =============================================================================
--
-- 사용자가 Tractive(GPS/만보계 tracker), Fi, 기타 외부 서비스를 연동해
-- 활동량/위치 등 객관 데이터를 자동 수집할 수 있게 한다. 발명 명세 모듈 A
-- 의 "측정 도구 메타데이터" 중 가장 정확도 높은 데이터 소스.
--
-- 정책:
--   · provider 별 1 사용자당 1 연동 (UNIQUE user_id+provider).
--   · access_token / refresh_token 은 평문 저장. 향후 vault 마이그레이션.
--     RLS 가 user_id = auth.uid() 강제 → 다른 사용자 토큰 접근 차단.
--   · status enum: 'active' / 'expired' / 'revoked'. 만료 시 cron 이 자동 갱신.
--   · provider 라벨: 'tractive', 'fi', 'whistle', 'manual_pedometer' 확장 가능.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN (
    'tractive', 'fi', 'whistle', 'manual_pedometer'
  )),
  -- 외부 서비스의 사용자 ID (Tractive 의 case 는 user_id). 사용자 본인 매칭.
  external_user_id text,
  -- OAuth tokens. nullable 이면 mock / 미등록.
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  -- 'active' = 사용 가능. 'expired' = 토큰 만료, 갱신 대기.
  -- 'revoked' = 사용자가 명시 해제. 'pending' = OAuth flow 시작 후 미완.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
  -- 마지막 동기화 시각 (cron 이 갱신).
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  -- 사용자당 provider 1개만.
  UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.user_integrations IS
  '외부 서비스 OAuth 연동 (Tractive, Fi 등). 42 deferred #1 / 발명 모듈 A.';

CREATE INDEX IF NOT EXISTS idx_user_integrations_user
  ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider_status
  ON public.user_integrations(provider, status);

-- RLS — 본인 row 만 SELECT/INSERT/UPDATE/DELETE.
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_integrations_select_own"
  ON public.user_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_integrations_insert_own"
  ON public.user_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_update_own"
  ON public.user_integrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_delete_own"
  ON public.user_integrations FOR DELETE
  USING (user_id = auth.uid());

-- updated_at 자동 갱신.
CREATE OR REPLACE FUNCTION public.touch_user_integrations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_integrations_updated ON public.user_integrations;
CREATE TRIGGER trg_user_integrations_updated
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_integrations_updated_at();
