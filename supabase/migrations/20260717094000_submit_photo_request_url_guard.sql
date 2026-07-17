-- submit_photo_request RPC 에 사진 URL 검증 추가 (2026-07-17 보안)
--
-- # 문제
-- 이 RPC 는 anon 에 GRANT 돼 있고 p_photo_url 을 검증 없이 dogs.photo_url 에 저장한다.
-- HTTP 라우트(app/api/photo-upload)는 크기·MIME·스토리지 path 를 검증하지만, RPC
-- 자체를 직접 호출하면 그 검증을 우회해 **강아지 사진을 임의 외부/악성 URL 로**
-- 바꿔치기할 수 있다(유효한 미사용 토큰 필요, 소유자 복구 가능 — 저위험이나 실사용
-- 라우트의 검증과 RPC 권한 경계가 어긋난 전형적 패턴).
--
-- # 조치
-- 정상 경로는 우리 Supabase 스토리지 public URL 만 넘긴다(getPublicUrl). 그 prefix 가
-- 아니면 거부 → 임의 URL 주입 차단. 나머지 동작은 그대로.

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
  -- 사진 URL 은 우리 스토리지 public URL 만 허용(임의/악성 외부 URL 주입 차단).
  IF p_photo_url IS NULL
     OR p_photo_url NOT LIKE 'https://adynmnrzffidoilnxutg.supabase.co/storage/v1/object/public/%' THEN
    RETURN jsonb_build_object('ok', false, 'message', '허용되지 않은 이미지 주소예요');
  END IF;

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

  UPDATE public.dogs SET photo_url = p_photo_url WHERE id = v_tok.dog_id;

  RETURN jsonb_build_object('ok', true, 'dogId', v_tok.dog_id);
END;
$$;
