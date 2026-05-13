-- =============================================================================
-- 친구 사진 부탁 토큰 — photo_request_tokens (P5 / 사용자 A-25)
-- =============================================================================
--
-- 보호자가 친구·가족에게 강아지 사진 한 장 부탁할 때 사용하는 토큰.
-- 익명 페이지 /photo-upload/[token] 으로 친구가 진입 → 사진 업로드 →
-- dog.photo_url 자동 적용 (보호자가 부탁한 것이라 cosent 묵시적).
--
-- 잘못된 사진이면 보호자가 dog 페이지에서 사진 변경 가능 — 정상 fallback.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.photo_request_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  -- 친구가 업로드한 사진 URL (storage public url). NULL = 아직 미업로드.
  uploaded_photo_url text,
  uploaded_at timestamptz,
  -- 보호자가 dog avatar 로 적용했는지 (자동 적용은 true 로 같이 set)
  applied_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_request_dog
  ON public.photo_request_tokens (dog_id);
CREATE INDEX IF NOT EXISTS idx_photo_request_token
  ON public.photo_request_tokens (token);

ALTER TABLE public.photo_request_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo_request_owner_all" ON public.photo_request_tokens;
CREATE POLICY "photo_request_owner_all" ON public.photo_request_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = photo_request_tokens.dog_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = photo_request_tokens.dog_id AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.photo_request_tokens IS
  '친구·가족에게 강아지 사진 부탁용 익명 업로드 토큰. P5 phase.';

-- 익명 진입 RPC — token 검증만 (사진 업로드 자체는 별도 storage 흐름)
CREATE OR REPLACE FUNCTION public.fetch_photo_request(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok RECORD;
  v_dog RECORD;
  v_owner_name text;
BEGIN
  SELECT * INTO v_tok
  FROM public.photo_request_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found',
      'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked',
      'message', '취소된 링크예요');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired',
      'message', '만료된 링크예요');
  END IF;
  IF v_tok.uploaded_photo_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_uploaded',
      'message', '이미 사진이 업로드된 링크예요');
  END IF;

  SELECT name INTO v_dog FROM public.dogs WHERE id = v_tok.dog_id;
  SELECT name INTO v_owner_name FROM public.profiles WHERE id = v_tok.created_by LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'dogName', v_dog.name,
    'ownerName', v_owner_name,
    'expiresAt', v_tok.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_photo_request(text) TO anon, authenticated;

-- 업로드 완료 RPC — uploaded_photo_url set + dog.photo_url 자동 적용
CREATE OR REPLACE FUNCTION public.submit_photo_request(
  p_token text,
  p_photo_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok RECORD;
BEGIN
  SELECT * INTO v_tok FROM public.photo_request_tokens
  WHERE token = p_token LIMIT 1;

  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL OR v_tok.expires_at < now()
     OR v_tok.uploaded_photo_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '사용할 수 없는 링크예요');
  END IF;

  UPDATE public.photo_request_tokens
  SET uploaded_photo_url = p_photo_url,
      uploaded_at = now(),
      applied_at = now()
  WHERE id = v_tok.id;

  -- dog.photo_url 자동 적용 — 보호자가 친구에게 부탁한 것이라 묵시 동의.
  UPDATE public.dogs SET photo_url = p_photo_url WHERE id = v_tok.dog_id;

  RETURN jsonb_build_object('ok', true, 'dogId', v_tok.dog_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_photo_request(text, text) TO anon, authenticated;
