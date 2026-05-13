-- =============================================================================
-- 수의사 read-only 공유 토큰 — vet_share_tokens
-- =============================================================================
--
-- 보호자가 동물병원 방문 전 수의사에게 강아지 정보 + 최근 분석을 공유할
-- 수 있는 magic link. 수의사는 farmerstail 가입 없이도 토큰만으로 진입.
--
-- # 설계
--  - 익명 진입이라 SECURITY DEFINER RPC (fetch_vet_share) 로 데이터 조회.
--    토큰 노출은 URL 에 있으므로 expires_at 짧게 (기본 14일) + revoke 지원.
--  - RLS: 보호자가 자기 토큰만 select/insert/update (revoke).
--  - 익명 진입은 GRANT EXECUTE ON FUNCTION fetch_vet_share TO anon — RLS 우회.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vet_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  -- 수의사가 페이지에 접속할 때마다 +1 (감사 / 사용 추적)
  accessed_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  -- 보호자가 revoke 할 수 있음 (마음 바뀌면). NULL = active.
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_share_dog
  ON public.vet_share_tokens (dog_id);
CREATE INDEX IF NOT EXISTS idx_vet_share_token
  ON public.vet_share_tokens (token);
-- 주의: partial index 의 predicate 에 now() 사용 불가 (IMMUTABLE 요구).
-- "active 토큰 조회" 는 query 시점에 expires_at > now() AND revoked_at IS NULL
-- 필터링 — idx_vet_share_dog 로 충분.

ALTER TABLE public.vet_share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vet_share_owner_all" ON public.vet_share_tokens;
CREATE POLICY "vet_share_owner_all" ON public.vet_share_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = vet_share_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.vet_share_tokens IS
  '보호자가 수의사에게 강아지 정보를 read-only 공유하는 토큰. 익명 진입은 fetch_vet_share() RPC 로.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fetch_vet_share(p_token) RPC — 익명 호출 가능. 토큰 유효성 검증 + 정보 반환.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fetch_vet_share(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok RECORD;
  v_dog RECORD;
  v_analysis RECORD;
  v_weight_latest RECORD;
  v_owner_name text;
BEGIN
  SELECT * INTO v_tok
  FROM public.vet_share_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_tok IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_found',
      'message', '유효하지 않은 링크예요'
    );
  END IF;

  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'revoked',
      'message', '공유가 취소된 링크예요'
    );
  END IF;

  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'expired',
      'message', '만료된 링크예요'
    );
  END IF;

  -- 접속 카운터 +1 (감사)
  UPDATE public.vet_share_tokens
  SET accessed_count = accessed_count + 1,
      last_accessed_at = now()
  WHERE id = v_tok.id;

  SELECT id, name, breed, gender, neutered, weight, birth_date,
         activity_level, allergies_source, weight_method, weight_measured_at,
         chronic_conditions, allergies
  INTO v_dog
  FROM public.dogs
  WHERE id = v_tok.dog_id;

  SELECT name INTO v_owner_name
  FROM public.profiles
  WHERE id = v_tok.created_by
  LIMIT 1;

  SELECT created_at, rer, mer, factor, stage, bcs_label, bcs_score,
         protein_pct, fat_pct, carb_pct, feed_g, ca_p_ratio, supplements,
         risk_flags, vet_consult_recommended, next_review_date
  INTO v_analysis
  FROM public.analyses
  WHERE dog_id = v_tok.dog_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT weight, measured_at
  INTO v_weight_latest
  FROM public.weight_logs
  WHERE dog_id = v_tok.dog_id
  ORDER BY measured_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'token', jsonb_build_object(
      'expiresAt', v_tok.expires_at,
      'accessedCount', v_tok.accessed_count + 1
    ),
    'owner', jsonb_build_object(
      'name', v_owner_name
    ),
    'dog', to_jsonb(v_dog),
    'analysis', CASE WHEN v_analysis IS NULL THEN NULL ELSE to_jsonb(v_analysis) END,
    'latestWeight', CASE WHEN v_weight_latest IS NULL THEN NULL ELSE to_jsonb(v_weight_latest) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_vet_share(text) TO anon, authenticated;

COMMENT ON FUNCTION public.fetch_vet_share(text) IS
  '익명 호출 가능. token 으로 dog + 최신 analysis + 최근 체중 정보 반환. SECURITY DEFINER 로 RLS 우회.';
