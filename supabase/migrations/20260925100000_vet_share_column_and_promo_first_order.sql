-- 2026-09-25 출시 전 점검 3차 — 함수 두 개 수정 (본문 외 속성·권한은 그대로).
--
-- ① fetch_vet_share: 수의사 공유 링크가 **항상** 실패했다.
--    dogs 에서 chronic_conditions 를 SELECT 하는데 그 컬럼은 dogs 에 없다(surveys 에만 있다,
--    20260425000013). plpgsql 은 늦게 바인딩하므로 가짜 토큰은 깨끗하게 not_found 를 주고,
--    **진짜 토큰만** 42703 으로 죽었다 — 강아지에게 위험 신호가 있을 때만 보이는 버튼이라
--    가장 필요한 순간에 조용히 안 됐다. 최신 설문의 chronic_conditions 로 채운다.
--    반환 모양(dog.chronic_conditions)은 그대로라 화면(app/vet/[token])은 안 바뀐다.
--
-- ② claim_promotion: 이벤트 할인은 **첫 주문 할인**이다(lib/promotions.ts, 사장님 결정
--    "이벤트 신규가입限"). 그런데 함수는 로그인·중복·기간·상한만 봐서, 이미 박스를 받고
--    있는 구독자가 로그아웃 상태로 이벤트 링크를 타고 다시 로그인하면 다음 결제가 50%
--    할인되고 이벤트 상한 한 자리를 먹었다. 결제한 적 있는 계정은 받을 수 없게 한다.
--    (이미 받은 claim 은 건드리지 않는다 — 체험단 뒤 첫 정상 결제에 쓰는 경로 보존.)

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
         activity_level, allergies_source, weight_method, weight_measured_at,
         allergies
  INTO v_dog FROM public.dogs WHERE id = v_tok.dog_id;

  -- 기저질환은 설문에 있다(dogs 에는 없다) — 최신 설문 기준.
  SELECT s.chronic_conditions INTO v_chronic
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
    'dog', to_jsonb(v_dog) || jsonb_build_object('chronic_conditions', to_jsonb(v_chronic)),
    'analysis', CASE WHEN v_analysis IS NULL THEN NULL ELSE to_jsonb(v_analysis) END,
    'latestWeight', CASE WHEN v_weight_latest IS NULL THEN NULL ELSE to_jsonb(v_weight_latest) END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_promotion(p_code text)
 RETURNS TABLE(ok boolean, reason text, rate numeric, promo_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_promo public.promotions%ROWTYPE;
  v_count integer;
BEGIN
  -- 로그인 안 했으면 거부(fail-closed). 가입 직후 호출되는 함수다.
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'unauthenticated', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- 이미 프로모션을 받은 계정이면 조용히 끝낸다(계정당 1회).
  IF EXISTS (SELECT 1 FROM public.promotion_claims c WHERE c.user_id = v_uid) THEN
    RETURN QUERY SELECT false, 'already_claimed', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- ★첫 주문 할인이다(2026-09-25) — 한 번이라도 결제한 계정은 받을 수 없다.
  --   환불된 결제도 결제 이력이다. 'cancelled' 는 결제 전 만료라 제외.
  IF EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.user_id = v_uid
       AND o.payment_status IN ('paid', 'partially_refunded', 'refunded')
  ) THEN
    RETURN QUERY SELECT false, 'not_first_order', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- ★ 행을 잠근다 — 이 잠금이 상한의 동시성을 막는다.
  SELECT * INTO v_promo FROM public.promotions p
   WHERE p.code = lower(trim(p_code))
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- 게이트 — lib/promotions.ts promotionGate 와 **같은 순서·같은 경계**여야 한다.
  IF NOT v_promo.active THEN
    RETURN QUERY SELECT false, 'inactive', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() < v_promo.starts_at THEN
    RETURN QUERY SELECT false, 'not_started', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() > v_promo.ends_at THEN
    RETURN QUERY SELECT false, 'ended', 0::numeric, v_promo.name; RETURN;
  END IF;

  IF v_promo.max_signups IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.promotion_claims c
     WHERE c.promotion_id = v_promo.id;
    IF v_count >= v_promo.max_signups THEN
      RETURN QUERY SELECT false, 'full', 0::numeric, v_promo.name; RETURN;
    END IF;
  END IF;

  INSERT INTO public.promotion_claims (promotion_id, user_id)
  VALUES (v_promo.id, v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY SELECT true, 'claimed', v_promo.discount_rate, v_promo.name;
END;
$function$;
