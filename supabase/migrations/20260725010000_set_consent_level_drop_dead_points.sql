-- 2026-07-25 — set_consent_level 의 死 포인트 블록 제거 (points-removal 뒷정리).
--
-- ⚠️ 정정(2026-07-25): 최초 이 마이그레이션을 "apply_point_delta 가 드롭돼
-- 동의 상향이 크래시하던 버그" 로 기술했으나 **오진**이었다. execute_sql 이
-- 다중 SELECT 의 마지막 결과만 반환해 apply_point_delta 존재 확인을 잘못 읽은
-- 것. apply_point_delta(uuid,integer,text,text,uuid) 는 **실제로 존재**하며,
-- set_consent_level 은 정상 작동하고 있었다(동의 상향이 깨지지 않았음).
--
-- [실제 성격] 死 포인트 적립 정리. 포인트는 2026-07 전면 폐기됐고 UI
-- (ConsentLevelCard)는 이미 reward 를 무시하는데, 이 함수만 여전히 동의 상향 시
-- point_ledger 에 유령 포인트를 적립하고 있었다. point_ledger 는 "동결된 과거
-- 원장(법정보관용)" 이 목적이라 새 적립이 계속 쌓이는 건 폐기 결정과 어긋난다
-- ("새 기능에 적립·포인트 X"). 그래서 포인트 블록만 제거 — 사용자 영향 0
-- (UI 가 이미 무시), point_ledger 에 死 행이 안 쌓이게 하는 정리.
--
-- [수정] consent_level UPDATE + consent_log INSERT 만 남긴다(함수 본래 목적).
-- 반환 shape 는 하위호환 위해 reward:0 / balanceAfter:null 유지(클라가 무시).

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
