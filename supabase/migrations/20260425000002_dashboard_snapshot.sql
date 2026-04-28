-- =============================================================================
-- dashboard_user_snapshot — 대시보드 user-scoped 데이터 1-shot RPC.
--
-- # 배경
--
-- /dashboard 는 본인 데이터로 5개 쿼리를 Promise.all 로 병렬 실행한다:
--   1) profiles.name
--   2) dogs (limit 3)
--   3) products (글로벌)
--   4) active subscription (limit 1)
--   5) events (글로벌)
--
-- 1/2/4 가 모두 user-scoped 라 한 트랜잭션 안에 합치면:
--   - HTTP/PostgREST 라운드트립 3 → 1 (~50-100ms 단축, 모바일 4G)
--   - Auth header / RLS 평가도 1회
--   - 같은 시점 스냅샷 (atomic — 사용자가 dog 추가 직후 아직 다른 쿼리는 이전 본 상태)
--
-- 3/5 는 글로벌이라 그대로 병렬 유지 (RPC 안에 포함시키면 캐시 가능성을 잃음).
--
-- # 보안
--
-- SECURITY DEFINER 로 정의하지만 함수 내부에서 `auth.uid() = p_user_id` 를
-- 검증해 본인 외 데이터 접근 차단. service_role 호출은 server-side 에서만
-- 일어나므로 별도 path 필요 없음.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_user_snapshot(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_profile JSONB;
  v_dogs JSONB;
  v_subscription JSONB;
BEGIN
  -- 본인 또는 service_role (auth.uid() 가 NULL — 서버에서 service key 호출).
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- profile.name 만 필요. 미생성 케이스 (PGRST116) 도 NULL 로 처리.
  SELECT to_jsonb(p) INTO v_profile
  FROM (
    SELECT name FROM public.profiles WHERE id = p_user_id
  ) p;

  -- dogs — 최근 등록 3마리.
  SELECT COALESCE(jsonb_agg(d ORDER BY (d->>'created_at') DESC), '[]'::jsonb)
    INTO v_dogs
  FROM (
    SELECT id, name, breed, birth_date, weight,
           created_at::text AS created_at
    FROM public.dogs
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 3
  ) d;

  -- 활성 정기배송 — 1건만 (다음배송 히어로 용).
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
$$;

REVOKE ALL ON FUNCTION public.dashboard_user_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_user_snapshot(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_user_snapshot IS
  'Returns dashboard user-scoped snapshot (profile, dogs, active subscription) in single round-trip. Caller must match auth.uid() unless invoked via service_role.';
