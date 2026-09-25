-- 2026-09-25 출시 전 점검 3차 — SQL 함수 4개의 '결제됨' 판정을 정본에 맞춘다.
--
-- lib/commerce/paid-status.ts 의 정본은 PAID_STATUSES = ('paid','partially_refunded') 다
-- (규칙42 — 품절 한 품목을 부분환불해도 그 박스는 나간다). 그런데 아래 네 함수는
-- payment_status = 'paid' 하나만 봐서, 부분환불된 박스가
--   · 고객 급여량 추정(avg_daily_feed_grams·feed_intake_history)에서 통째로 빠지고
--   · 어드민 코호트 LTV·리텐션에서 그 회차가 '이탈'로 세어졌다.
-- 규칙42 는 TypeScript 만 검사해서 SQL 에 남은 줄 몰랐다. (지금 부분환불 주문 0건 — 무피해.)
--
-- 함께 바로잡는 것:
--   · 급여량: 부분환불로 **취소된 품목**(order_items.cancelled_at)은 박스에 없었으니 뺀다.
--   · LTV: 부분환불분은 매출이 아니다 — total_amount − refunded_amount.
-- 속성(SECURITY·search_path·권한)은 기존 그대로다.

CREATE OR REPLACE FUNCTION public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer DEFAULT 30)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT COALESCE(
    SUM((oi.quantity * p.net_weight_g)::numeric) / GREATEST(p_window_days, 1),
    0
  )
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.user_id = p_user_id
    AND o.payment_status IN ('paid', 'partially_refunded')
    AND oi.cancelled_at IS NULL
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
    AND o.paid_at >= NOW() - (p_window_days || ' days')::interval
$function$;

CREATE OR REPLACE FUNCTION public.feed_intake_history(p_user_id uuid)
 RETURNS TABLE(paid_date date, total_grams bigint, product_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT
    DATE(o.paid_at AT TIME ZONE 'Asia/Seoul') AS paid_date,
    SUM((oi.quantity * COALESCE(p.net_weight_g, 0))::bigint) AS total_grams,
    COUNT(DISTINCT oi.product_id)::integer AS product_count
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.user_id = p_user_id
    AND o.payment_status IN ('paid', 'partially_refunded')
    AND oi.cancelled_at IS NULL
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
  GROUP BY DATE(o.paid_at AT TIME ZONE 'Asia/Seoul')
  ORDER BY paid_date DESC
$function$;

CREATE OR REPLACE FUNCTION public.cohort_ltv_weekly(weeks_back integer DEFAULT 12)
 RETURNS TABLE(cohort_week date, cohort_size bigint, ltv_d7 numeric, ltv_d30 numeric, ltv_d90 numeric, ltv_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 매출 지표다. admin 아니면 거부(fail-closed — 비로그인도 여기서 걸린다).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT
      date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
      p.id AS user_id,
      (p.created_at AT TIME ZONE 'Asia/Seoul')::date AS join_date
    FROM public.profiles p
    WHERE p.created_at >= now() - (weeks_back || ' weeks')::interval
  ),
  spend AS (
    SELECT
      c.cohort_week,
      c.user_id,
      -- 부분환불분은 매출이 아니다(2026-09-25).
      (o.total_amount - COALESCE(o.refunded_amount, 0)) AS total_amount,
      EXTRACT(EPOCH FROM (o.created_at - (c.join_date::timestamp AT TIME ZONE 'Asia/Seoul'))) / 86400.0 AS days_since_join
    FROM cohorts c
    LEFT JOIN public.orders o
      ON o.user_id = c.user_id
     AND o.payment_status IN ('paid', 'partially_refunded')
  )
  SELECT
    s.cohort_week,
    COUNT(DISTINCT s.user_id) AS cohort_size,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 7), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d7,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 30), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d30,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 90), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d90,
    COALESCE(SUM(s.total_amount), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_total
  FROM spend s
  GROUP BY s.cohort_week
  ORDER BY s.cohort_week DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cohort_retention_weekly(p_max_cohorts integer DEFAULT 12)
 RETURNS TABLE(cohort_week date, cohort_size bigint, retention_w0 numeric, retention_w1 numeric, retention_w2 numeric, retention_w4 numeric, retention_w8 numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT
      date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
      p.id AS user_id,
      p.created_at AS joined_at
    FROM public.profiles p
    WHERE p.created_at >= now() - ((p_max_cohorts * 7) || ' days')::interval
  ),
  last_paid AS (
    SELECT
      c.cohort_week,
      c.user_id,
      c.joined_at,
      MAX(EXTRACT(EPOCH FROM (o.paid_at - c.joined_at)) / 604800.0) AS weeks_survived
    FROM cohorts c
    LEFT JOIN public.orders o
      ON o.user_id = c.user_id
     AND o.payment_status IN ('paid', 'partially_refunded')
     AND o.paid_at IS NOT NULL
    GROUP BY c.cohort_week, c.user_id, c.joined_at
  ),
  agg AS (
    SELECT
      lp.cohort_week AS cw,
      COUNT(*) AS csize,
      MIN(EXTRACT(EPOCH FROM (now() - lp.joined_at)) / 604800.0) AS weeks_observed,
      COUNT(*) FILTER (WHERE lp.weeks_survived IS NOT NULL) AS s0,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 1) AS s1,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 2) AS s2,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 4) AS s4,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 8) AS s8
    FROM last_paid lp
    GROUP BY lp.cohort_week
  )
  SELECT
    a.cw,
    a.csize,
    (a.s0::numeric / NULLIF(a.csize, 0)),
    CASE WHEN a.weeks_observed >= 1 THEN a.s1::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 2 THEN a.s2::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 4 THEN a.s4::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 8 THEN a.s8::numeric / NULLIF(a.csize, 0) END
  FROM agg a
  ORDER BY a.cw DESC;
END;
$function$;
