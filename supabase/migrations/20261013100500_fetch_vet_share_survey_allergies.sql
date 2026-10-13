-- 수의사 공유 링크(fetch_vet_share)의 알레르기를 최신 설문에서 읽기 (2026-10-13 점검, 규칙197).
--
-- # 왜
-- 알레르기는 설문(surveys.answers.allergies)에만 저장되고 dogs.allergies 는 비어 있다. 그런데 이 함수는
-- dogs.allergies 를 내보내서, 알레르기가 있는 강아지도 수의사 화면(app/vet/[token])에 알레르기가 안 떴다.
-- 기저질환은 이미 최신 설문(surveys.chronic_conditions)에서 읽고 있었다(20260925100000) — 같은 방식으로 맞춘다.
--
-- # 어떻게
-- 운영 정의를 SELECT(pg_get_functiondef, 2026-10-13)로 받아 두 곳만 바꿨다:
--   · dogs 조회에서 allergies 를 뺐다.
--   · 최신 설문 한 행에서 chronic_conditions 와 answers->'allergies'(배열일 때만)를 같이 읽어 dog 에 덧붙인다.
-- 반환 모양(dog.allergies = 문자열 배열 또는 null)은 그대로라 화면은 안 바뀐다.
-- SECURITY DEFINER · search_path public · 권한은 create or replace 가 유지한다. 다시 실행해도 안전하다.

CREATE OR REPLACE FUNCTION public.fetch_vet_share(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tok RECORD;
  v_dog RECORD;
  v_chronic text[];
  v_allergies jsonb;
  v_analysis RECORD;
  v_weight_latest RECORD;
  v_owner_name text;
BEGIN
  SELECT * INTO v_tok FROM public.vet_share_tokens WHERE token = p_token LIMIT 1;
  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked', 'message', '공유가 취소된 링크예요');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired', 'message', '만료된 링크예요');
  END IF;

  UPDATE public.vet_share_tokens
  SET accessed_count = accessed_count + 1, last_accessed_at = now()
  WHERE id = v_tok.id;

  SELECT id, name, breed, gender, neutered, weight, birth_date,
         activity_level, allergies_source, weight_method, weight_measured_at
  INTO v_dog FROM public.dogs WHERE id = v_tok.dog_id;

  -- 기저질환·알레르기는 설문에 있다(dogs 에는 없다) — 최신 설문 기준.
  SELECT s.chronic_conditions,
         CASE WHEN jsonb_typeof(s.answers -> 'allergies') = 'array' THEN s.answers -> 'allergies' ELSE NULL END
  INTO v_chronic, v_allergies
  FROM public.surveys s
  WHERE s.dog_id = v_tok.dog_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT name INTO v_owner_name FROM public.profiles WHERE id = v_tok.created_by LIMIT 1;

  SELECT created_at, rer, mer, factor, stage, bcs_label, bcs_score,
         protein_pct, fat_pct, carb_pct, feed_g, ca_p_ratio, supplements,
         risk_flags, vet_consult_recommended, next_review_date
  INTO v_analysis FROM public.analyses
  WHERE dog_id = v_tok.dog_id ORDER BY created_at DESC LIMIT 1;

  SELECT weight, measured_at INTO v_weight_latest
  FROM public.weight_logs WHERE dog_id = v_tok.dog_id ORDER BY measured_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'token', jsonb_build_object('expiresAt', v_tok.expires_at, 'accessedCount', v_tok.accessed_count + 1),
    'owner', jsonb_build_object('name', v_owner_name),
    'dog', to_jsonb(v_dog) || jsonb_build_object('chronic_conditions', to_jsonb(v_chronic), 'allergies', v_allergies),
    'analysis', CASE WHEN v_analysis IS NULL THEN NULL ELSE to_jsonb(v_analysis) END,
    'latestWeight', CASE WHEN v_weight_latest IS NULL THEN NULL ELSE to_jsonb(v_weight_latest) END
  );
END;
$function$;

-- 자기 검증 — 새 정의가 dogs.allergies 대신 설문을 읽는다.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.fetch_vet_share(text)'::regprocedure) into v_def;
  if v_def not ilike '%answers -> ''allergies''%' then
    raise exception 'fetch_vet_share 가 설문 알레르기를 읽지 않는다';
  end if;
  if v_def ilike '%weight_measured_at,%allergies%INTO v_dog%' then
    raise exception 'fetch_vet_share 가 아직 dogs.allergies 를 읽는다';
  end if;
end $$;
