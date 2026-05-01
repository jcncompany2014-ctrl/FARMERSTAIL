-- Native push tokens (APNs / FCM).
--
-- # 배경
-- push_subscriptions 는 Web Push (PWA) 전용 — endpoint URL + p256dh/auth 키.
-- Capacitor iOS/Android 네이티브는 APNs / FCM 토큰만 사용해 별도 테이블.
-- 같은 사용자가 PWA + 네이티브 앱 둘 다 쓰면 row 가 양쪽에 다 생김 — 발송 시
-- 두 테이블 모두 fan-out.

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  -- APNs / FCM 토큰 — 둘 다 길이가 다르고 형식이 달라 텍스트로 저장.
  token text NOT NULL,
  -- 디바이스 식별 (한 유저가 여러 디바이스 가능). UNIQUE 키.
  device_id text,
  -- 사용자가 native 앱 어디서 등록했는지 추적 — 디버깅 / churn 분석.
  app_version text,
  os_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 한 디바이스가 토큰 갱신 시 같은 행을 update — UNIQUE 가 (user, device).
  CONSTRAINT native_push_user_device UNIQUE (user_id, device_id)
);

-- 같은 토큰이 여러 사용자에 묶이는 일은 정상이지만 (한 디바이스를 여러 사용자가
-- 사용), 한 사용자에 같은 device_id 두 번은 의미 없음 → UNIQUE.
-- 토큰 자체에도 GIN-style 빠른 lookup 인덱스.
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx
  ON public.native_push_tokens (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS native_push_tokens_token_idx
  ON public.native_push_tokens (token);

-- updated_at 자동 갱신 트리거.
CREATE OR REPLACE FUNCTION public.set_native_push_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS native_push_tokens_updated_at ON public.native_push_tokens;
CREATE TRIGGER native_push_tokens_updated_at
  BEFORE UPDATE ON public.native_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_native_push_updated_at();

-- RLS — 본인 토큰만 read/insert/update/delete.
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "native_push_select_own" ON public.native_push_tokens;
CREATE POLICY "native_push_select_own"
  ON public.native_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "native_push_insert_own" ON public.native_push_tokens;
CREATE POLICY "native_push_insert_own"
  ON public.native_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "native_push_update_own" ON public.native_push_tokens;
CREATE POLICY "native_push_update_own"
  ON public.native_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "native_push_delete_own" ON public.native_push_tokens;
CREATE POLICY "native_push_delete_own"
  ON public.native_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.native_push_tokens IS
  'Capacitor 네이티브 앱 푸시 토큰 (APNs/FCM). PWA Web Push 는 push_subscriptions 별도.';
