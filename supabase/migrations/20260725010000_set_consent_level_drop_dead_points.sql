-- 2026-07-25 — set_consent_level 의 死 포인트 블록 제거 (기능 버그 + points-removal 뒷정리).
--
-- [버그] 이 함수는 동의 단계를 처음 올리는 사용자(p_level > consent_max_rewarded_level)
-- 에게 `apply_point_delta(...)` 로 응원 포인트를 적립했는데, apply_point_delta 는
-- 2026-07 포인트 전면 폐기 때 **드롭됐다**. 그래서 동의 상향 시 undefined_function
-- 에러 → 트랜잭션 롤백 → consent_level 저장 자체가 실패했다. 데이터 동의 상향
-- 기능이 깨진 상태였다(베타에서 미사용이라 미노출). 클라(ConsentLevelCard)는
-- 이미 reward 를 무시하도록 정리돼 있어, 서버에서 포인트 블록만 걷어내면 된다.
--
-- [수정] consent_level UPDATE + consent_log INSERT 만 남긴다(함수 본래 목적).
-- 포인트 적립·consent_max_rewarded_level 추적 제거. 반환 shape 는 하위호환 위해
-- reward:0 / balanceAfter:null 유지(클라가 무시).

CREATE OR REPLACE FUNCTION public.set_consent_level(p_level smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prev smallint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '로그인이 필요해요');
  END IF;
  IF p_level < 1 OR p_level > 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', '유효하지 않은 동의 단계예요');
  END IF;

  SELECT consent_level INTO v_prev FROM public.profiles WHERE id = v_uid;
  IF v_prev IS NULL THEN v_prev := 1; END IF;

  UPDATE public.profiles SET consent_level = p_level WHERE id = v_uid;

  INSERT INTO public.consent_log (user_id, channel, granted, policy_version, source)
  VALUES (v_uid, 'consent_level', p_level > 1, 'v1', 'set_consent_level');

  -- 포인트 응원 적립 제거(2026-07 포인트 폐기 + apply_point_delta 드롭). reward 고정 0.
  RETURN jsonb_build_object('ok', true, 'prev', v_prev, 'next', p_level, 'reward', 0, 'balanceAfter', null);
END;
$function$;
