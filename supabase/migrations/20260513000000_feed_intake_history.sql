-- 사료 배송 무게 자동 추적 RPC — voice-guidelines / 발명 모듈 A.
--
-- 사용자가 자체 사료 (4종 라인) 정기배송 시, 매 박스 정확한 그램수가
-- products.net_weight_g 에 저장되어 있다. 견주가 별도로 급여량 측정
-- 안 해도 시스템이 "이 기간에 N kg 배송" 자동 추적 → 평균 일일 급여량
-- 산출 가능 (배송량 / 기간).
--
-- 신뢰도: 1.0 (배송된 양은 정확). 견주 자가 입력 측정 (계량컵 ±15%) 대비
-- 압도적 정확도. 자체 사료 D2C 의 핵심 차별화.
--
-- 출력: 일자별 결제 총 그램수 + 제품 종류 수.

CREATE OR REPLACE FUNCTION public.feed_intake_history(p_user_id uuid)
RETURNS TABLE (
  paid_date date,
  total_grams bigint,
  product_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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
    AND o.payment_status = 'paid'
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
  GROUP BY DATE(o.paid_at AT TIME ZONE 'Asia/Seoul')
  ORDER BY paid_date DESC
$function$;

-- SECURITY INVOKER + orders.RLS 가 user_id = auth.uid() 강제. admin 은
-- service role 로 우회. 일반 사용자는 본인 데이터만 접근.

COMMENT ON FUNCTION public.feed_intake_history(uuid) IS
  '사용자의 paid orders 의 사료 그램수 시계열. 자체 사료 D2C 자동 추적.';

-- 평균 일일 급여량 산출 (지난 30/60/90일 기간 합산 / 일수).
CREATE OR REPLACE FUNCTION public.avg_daily_feed_grams(
  p_user_id uuid,
  p_window_days integer DEFAULT 30
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
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
    AND o.payment_status = 'paid'
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
    AND o.paid_at >= NOW() - (p_window_days || ' days')::interval
$function$;

COMMENT ON FUNCTION public.avg_daily_feed_grams(uuid, integer) IS
  '지정 기간 평균 일일 사료 급여량 (g). 발명 모듈 A — 자동 추적, 신뢰도 1.0.';
