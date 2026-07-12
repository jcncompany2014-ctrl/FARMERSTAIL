-- 홈 대시보드 스냅샷 RPC: 강아지 LIMIT 3 → 50, 정렬 DESC → ASC.
--
-- 버그(2026-07-12 사장님 리포트): 강아지가 4마리 이상이면 홈 "내 아이들"에
-- 최신 3마리만 뜨고("(03)"), 헤더 강아지 선택 토글로 고른 4번째 강아지를 홈
-- 리스트가 못 찾아 활성 표시가 다른 강아지로 어긋남. 원인은 이 RPC 의 LIMIT 3.
--
-- created_at ASC 로 통일 — AppChrome 헤더 칩(등록순 ASC)과 홈의 기본 활성
-- 강아지가 일치하도록(쿠키 없을 때 header/dashboard 기본 강아지 불일치 방지).
--
-- 이미 프로덕션에 apply_migration 으로 적용됨. 이 파일은 레포 재현용 기록.
CREATE OR REPLACE FUNCTION public.dashboard_user_snapshot(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
  v_profile JSONB;
  v_dogs JSONB;
  v_subscription JSONB;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(p) INTO v_profile
  FROM (
    SELECT name FROM public.profiles WHERE id = p_user_id
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at ASC), '[]'::jsonb)
    INTO v_dogs
  FROM (
    SELECT id, name, breed, birth_date, weight,
           created_at::text AS created_at
    FROM public.dogs
    WHERE user_id = p_user_id
    ORDER BY created_at ASC
    LIMIT 50
  ) d;

  SELECT to_jsonb(s) INTO v_subscription
  FROM (
    SELECT
      s.id,
      s.status,
      s.next_delivery_date,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('product_name', si.product_name))
         FROM public.subscription_items si
         WHERE si.subscription_id = s.id),
        '[]'::jsonb
      ) AS subscription_items
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1
  ) s;

  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, 'null'::jsonb),
    'dogs', v_dogs,
    'subscription', COALESCE(v_subscription, 'null'::jsonb)
  );
END;
$function$;
