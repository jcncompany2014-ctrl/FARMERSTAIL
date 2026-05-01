-- 코호트 리텐션 분석 RPC.
--
-- # 정의
-- 코호트 = 같은 가입 주(week) 의 사용자 묶음.
-- 리텐션[N] = 그 주에 가입한 사용자 중, 가입 후 N 주차에 1회 이상 주문한 비율.
--
-- 예: 2026-04-01 가입 코호트 100명 중 4주차에 30명이 재구매 → R4 = 30%
--
-- # 출력
-- 한 행 = 한 가입 주 코호트.
--   cohort_week         — 'YYYY-MM-DD' (해당 주의 월요일 KST)
--   cohort_size         — 그 주 가입자 수
--   active_w0..w8       — 가입 직후 ~ 8주차 retention rate (0.0 ~ 1.0)
--
-- # 성능
-- profiles + orders 가 N×M 조인 → 코호트 26주 (~6개월) 까지 캡. 그 이상은
-- 운영 초기엔 의미 적고, 트래픽 늘면 materialized view 로 전환.
--
-- # 보안
-- SECURITY DEFINER 로 admin 만 호출 가능 — caller 가 admin 인지 RPC 안에서
-- 검증. 일반 사용자는 본인 데이터만 RLS 로 접근.

CREATE OR REPLACE FUNCTION public.cohort_retention_weekly(
  p_max_cohorts integer DEFAULT 12
)
RETURNS TABLE (
  cohort_week date,
  cohort_size integer,
  retention_w0 numeric,
  retention_w1 numeric,
  retention_w2 numeric,
  retention_w4 numeric,
  retention_w8 numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  -- admin 검증 — JWT app_metadata.role 또는 profiles.role
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF v_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT
      date_trunc('week', (p.created_at AT TIME ZONE 'Asia/Seoul'))::date AS cohort_wk,
      p.id AS user_id,
      (p.created_at AT TIME ZONE 'Asia/Seoul')::timestamptz AS joined_at
    FROM public.profiles p
    WHERE p.created_at >= now() - (p_max_cohorts || ' weeks')::interval
  ),
  cohort_orders AS (
    SELECT
      c.cohort_wk,
      c.user_id,
      EXTRACT(epoch FROM (o.created_at AT TIME ZONE 'Asia/Seoul') - c.joined_at)::int / (7 * 24 * 3600) AS week_offset,
      o.id AS order_id
    FROM cohorts c
    JOIN public.orders o ON o.user_id = c.user_id
    WHERE o.payment_status = 'paid'
  ),
  agg AS (
    SELECT
      cohort_wk,
      week_offset,
      COUNT(DISTINCT user_id) AS active_users
    FROM cohort_orders
    WHERE week_offset BETWEEN 0 AND 8
    GROUP BY cohort_wk, week_offset
  ),
  sizes AS (
    SELECT cohort_wk, COUNT(DISTINCT user_id)::int AS size
    FROM cohorts
    GROUP BY cohort_wk
  )
  SELECT
    s.cohort_wk AS cohort_week,
    s.size AS cohort_size,
    COALESCE(MAX(a.active_users) FILTER (WHERE a.week_offset = 0), 0) / NULLIF(s.size, 0)::numeric AS retention_w0,
    COALESCE(MAX(a.active_users) FILTER (WHERE a.week_offset = 1), 0) / NULLIF(s.size, 0)::numeric AS retention_w1,
    COALESCE(MAX(a.active_users) FILTER (WHERE a.week_offset = 2), 0) / NULLIF(s.size, 0)::numeric AS retention_w2,
    COALESCE(MAX(a.active_users) FILTER (WHERE a.week_offset = 4), 0) / NULLIF(s.size, 0)::numeric AS retention_w4,
    COALESCE(MAX(a.active_users) FILTER (WHERE a.week_offset = 8), 0) / NULLIF(s.size, 0)::numeric AS retention_w8
  FROM sizes s
  LEFT JOIN agg a ON a.cohort_wk = s.cohort_wk
  GROUP BY s.cohort_wk, s.size
  ORDER BY s.cohort_wk DESC;
END;
$$;

COMMENT ON FUNCTION public.cohort_retention_weekly(integer) IS
  '주별 코호트 리텐션. 가입 주 기준, 0~8주차 재구매율 (paid 주문 기준). admin only.';
