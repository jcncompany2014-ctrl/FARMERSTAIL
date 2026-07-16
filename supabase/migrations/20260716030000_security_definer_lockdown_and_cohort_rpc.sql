-- 🚨 보안 수정 + 코호트 리텐션 RPC (2026-07-16) — 프로덕션 적용 완료
-- DB 실제 버전: 20260716035332 · 044345 · 044419 · 044529 · 044616 · 044638 · 044902
--
-- ══════════════════════════════════════════════════════════════════════════
-- 실증된 취약점 — 비로그인이 남의 개인정보를 뽑을 수 있었다
-- ══════════════════════════════════════════════════════════════════════════
-- `dashboard_user_snapshot(p_user_id)` 를 **anon 역할로 호출해 남의 정보가 그대로
-- 나왔다** — 프로필 이름 + 강아지 전체(이름·견종·생일·체중) + 구독.
-- Supabase anon 키는 프론트엔드 번들에 박혀 있으니 **사실상 누구나** 가능했다.
--
-- ── 원인 ① fail-open 가드
--      IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN 거부   ❌
--    "로그인했으면 본인인지 확인"만 있고 **"아예 로그인 안 했으면 거부"가 없다.**
--    비로그인이면 auth.uid() 가 NULL 이라 검사를 건너뛴다. SECURITY DEFINER 라 RLS 도 우회.
--
-- ── 원인 ② PostgreSQL 은 함수에 PUBLIC EXECUTE 를 기본으로 준다
--    `REVOKE ... FROM anon` 만 하면 **명시적 GRANT 가 있던 것만** 닫힌다.
--    1차 회수 후 재조회했더니 32개→27개밖에 안 줄어서 알아챘다.
--    **REVOKE ... FROM PUBLIC** 이라야 진짜로 닫힌다.
--
-- ⛔ 되돌리지 말 것. 새 SECURITY DEFINER 함수를 만들 땐:
--    1) 가드를 `IS NULL OR ...` (fail-closed)로 시작
--    2) 권한은 PUBLIC 에서 회수하고 필요한 역할에만 GRANT
--    3) 권한 + 가드 **이중**으로 (권한만 믿으면 GRANT 되돌릴 때 뚫린다)
--    4) get_advisors(type='security') 로 확인
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1) fail-closed 가드
create or replace function public.dashboard_user_snapshot(p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_caller UUID := auth.uid();
  v_profile JSONB; v_dogs JSONB; v_subscription JSONB;
BEGIN
  -- ⚠️ fail-closed. 예전엔 `IS NOT NULL AND` 라서 **비로그인이면 통과**했다.
  IF v_caller IS NULL OR v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(p) INTO v_profile
  FROM (SELECT name FROM public.profiles WHERE id = p_user_id) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at ASC), '[]'::jsonb) INTO v_dogs
  FROM (
    SELECT id, name, breed, birth_date, weight, created_at::text AS created_at
    FROM public.dogs WHERE user_id = p_user_id ORDER BY created_at ASC LIMIT 50
  ) d;

  SELECT to_jsonb(s) INTO v_subscription
  FROM (
    SELECT s.id, s.status, s.next_delivery_date,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('product_name', si.product_name))
                FROM public.subscription_items si WHERE si.subscription_id = s.id),
               '[]'::jsonb) AS subscription_items
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  ) s;

  RETURN jsonb_build_object('profile', COALESCE(v_profile, 'null'::jsonb),
                            'dogs', v_dogs,
                            'subscription', COALESCE(v_subscription, 'null'::jsonb));
END;
$function$;

comment on function public.dashboard_user_snapshot(uuid) is
  '⚠️ 2026-07-16: anon 이 이 함수로 남의 프로필·강아지·구독을 통째로 뽑을 수 있었다(실증). 가드가 fail-open 이었다. 가드 fail-closed + EXECUTE 회수로 수정.';

-- ── 2) 트리거 전용 함수 — RPC 로 노출될 이유 0.
--    (PostgreSQL 은 트리거 실행 시 EXECUTE 를 검사하지 않으므로 회수해도 발화한다.)
revoke execute on function public.addresses_manage_default() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;
revoke execute on function public.prevent_vet_share_token_tampering() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.set_native_push_updated_at() from public, anon, authenticated;
revoke execute on function public.tg_orders_apply_tier_spend() from public, anon, authenticated;
revoke execute on function public.tg_orders_increment_sales_count() from public, anon, authenticated;
revoke execute on function public.tg_orders_stamp() from public, anon, authenticated;
revoke execute on function public.tg_refunds_apply_partial() from public, anon, authenticated;
revoke execute on function public.tg_stamps_refresh_count() from public, anon, authenticated;

-- ── 3) 남의 데이터를 읽거나 조작할 수 있던 것
revoke execute on function public.dashboard_user_snapshot(uuid) from public, anon;
grant  execute on function public.dashboard_user_snapshot(uuid) to authenticated;

revoke execute on function public.apply_point_delta(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.upsert_cart_item(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;

revoke execute on function public.record_reward_event(text, text, numeric, uuid, jsonb) from public, anon;
grant  execute on function public.record_reward_event(text, text, numeric, uuid, jsonb) to service_role;

revoke execute on function public.fn_refresh_stamp_count(uuid) from public, anon, authenticated;
grant  execute on function public.fn_refresh_stamp_count(uuid) to service_role;

-- 재고 조작 — 서버만
revoke execute on function public.reserve_order_stock(jsonb) from public, anon, authenticated;
grant  execute on function public.reserve_order_stock(jsonb) to service_role;
revoke execute on function public.restore_stock(uuid, integer) from public, anon, authenticated;
grant  execute on function public.restore_stock(uuid, integer) to service_role;

-- 레이트리밋 내부 — 열려 있으면 남의 IP 카운터를 올려 차단시킬 수 있다
revoke execute on function public.incr_rate_limit_counter(text, text, bigint) from public, anon, authenticated;
grant  execute on function public.incr_rate_limit_counter(text, text, bigint) to service_role;
revoke execute on function public.sweep_rate_limit_counters() from public, anon, authenticated;
grant  execute on function public.sweep_rate_limit_counters() to service_role;

-- ── 4) 공개 버킷의 넓은 SELECT 정책 제거
--    공개 버킷은 URL 로 파일을 준다. 여기에 SELECT 정책까지 있으면 클라이언트가
--    **파일 목록을 통째로 훑을 수 있다**(경로를 몰라도 전부 나열).
--    review-photos 는 지금 0장이지만 곧 고객 사진이 쌓인다 — 차면 늦는다.
--    코드에 `.list()` 호출이 한 군데도 없음을 확인하고 제거.
drop policy if exists "review-photos public read" on storage.objects;
drop policy if exists "event-images public read" on storage.objects;

-- ══════════════════════════════════════════════════════════════════════════
-- 코호트 리텐션 RPC 신설 — admin 이 부르는데 **DB 에 존재한 적이 없었다.**
-- 코드가 try/catch 빈 배열 폴백을 해서 에러 없이 **표가 영원히 빈 채로** 떴다.
--
-- ⚠️ 정의를 바꿨다. 표 주석은 "해당 주차에 결제한 비율"이라 했지만 그건 배송주기가
-- 1주/2주/4주 이던 시절 스펙이다. **지금은 2주 고정**이라 W1·W3 결제자가 구조적으로
-- 0명이고, 그 정의면 W1 이 항상 0% 로 찍혀 "즉시 이탈"이라는 거짓 신호를 매번 준다.
-- → **생존**: retention_wN = (마지막 결제가 가입 +N주 이후인 사용자) / 코호트 크기.
--   2주 주기와 무관하고 좌→우 단조 감소한다. 관측 기간 미달 칸은 NULL(UI 는 '—').
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.cohort_retention_weekly(p_max_cohorts integer default 12)
returns table (
  cohort_week date, cohort_size bigint,
  retention_w0 numeric, retention_w1 numeric, retention_w2 numeric,
  retention_w4 numeric, retention_w8 numeric
)
language plpgsql security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
           p.id AS user_id, p.created_at AS joined_at
    FROM public.profiles p
    WHERE p.created_at >= now() - ((p_max_cohorts * 7) || ' days')::interval
  ),
  last_paid AS (
    SELECT c.cohort_week, c.user_id, c.joined_at,
           MAX(EXTRACT(EPOCH FROM (o.paid_at - c.joined_at)) / 604800.0) AS weeks_survived
    FROM cohorts c
    LEFT JOIN public.orders o
      ON o.user_id = c.user_id AND o.payment_status = 'paid' AND o.paid_at IS NOT NULL
    GROUP BY c.cohort_week, c.user_id, c.joined_at
  ),
  agg AS (
    SELECT lp.cohort_week AS cw, COUNT(*) AS csize,
           MIN(EXTRACT(EPOCH FROM (now() - lp.joined_at)) / 604800.0) AS weeks_observed,
           COUNT(*) FILTER (WHERE lp.weeks_survived IS NOT NULL) AS s0,
           COUNT(*) FILTER (WHERE lp.weeks_survived >= 1) AS s1,
           COUNT(*) FILTER (WHERE lp.weeks_survived >= 2) AS s2,
           COUNT(*) FILTER (WHERE lp.weeks_survived >= 4) AS s4,
           COUNT(*) FILTER (WHERE lp.weeks_survived >= 8) AS s8
    FROM last_paid lp GROUP BY lp.cohort_week
  )
  SELECT a.cw, a.csize,
    (a.s0::numeric / NULLIF(a.csize, 0)),
    CASE WHEN a.weeks_observed >= 1 THEN a.s1::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 2 THEN a.s2::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 4 THEN a.s4::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 8 THEN a.s8::numeric / NULLIF(a.csize, 0) END
  FROM agg a ORDER BY a.cw DESC;
END;
$function$;

comment on function public.cohort_retention_weekly(integer) is
  '가입 주 코호트별 **생존** 리텐션. retention_wN = 마지막 결제가 가입 +N주 이후인 사용자 비율(0~1). 배송이 2주 고정이라 "그 주에 결제했나"로 세면 W1 이 항상 0 이 되어 거짓 신호를 준다. 관측 기간 미달 칸은 NULL.';

revoke execute on function public.cohort_retention_weekly(integer) from public, anon;
grant  execute on function public.cohort_retention_weekly(integer) to authenticated;

-- ── cohort_ltv_weekly — **비로그인도 매출·LTV 를 가져갈 수 있었다.**
--    SECURITY DEFINER 인데 안에 admin 검사가 없었다. 본문은 기존과 동일, 가드만 추가.
create or replace function public.cohort_ltv_weekly(weeks_back integer default 12)
returns table(cohort_week date, cohort_size bigint, ltv_d7 numeric, ltv_d30 numeric, ltv_d90 numeric, ltv_total numeric)
language plpgsql security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
           p.id AS user_id, (p.created_at AT TIME ZONE 'Asia/Seoul')::date AS join_date
    FROM public.profiles p
    WHERE p.created_at >= now() - (weeks_back || ' weeks')::interval
  ),
  spend AS (
    SELECT c.cohort_week, c.user_id, o.total_amount,
           EXTRACT(EPOCH FROM (o.created_at - (c.join_date::timestamp AT TIME ZONE 'Asia/Seoul'))) / 86400.0 AS days_since_join
    FROM cohorts c
    LEFT JOIN public.orders o ON o.user_id = c.user_id AND o.payment_status = 'paid'
  )
  SELECT s.cohort_week, COUNT(DISTINCT s.user_id),
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 7), 0)::numeric / NULLIF(COUNT(DISTINCT s.user_id), 0),
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 30), 0)::numeric / NULLIF(COUNT(DISTINCT s.user_id), 0),
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 90), 0)::numeric / NULLIF(COUNT(DISTINCT s.user_id), 0),
    COALESCE(SUM(s.total_amount), 0)::numeric / NULLIF(COUNT(DISTINCT s.user_id), 0)
  FROM spend s GROUP BY s.cohort_week ORDER BY s.cohort_week DESC;
END;
$function$;

comment on function public.cohort_ltv_weekly(integer) is
  '주별 코호트 LTV. ⚠️ 2026-07-16: admin 가드가 없고 EXECUTE 가 PUBLIC 이라 **비로그인도 매출 지표를 가져갈 수 있었다**. is_admin() 가드 + EXECUTE 제한 이중으로 수정.';

revoke execute on function public.cohort_ltv_weekly(integer) from public, anon;
grant  execute on function public.cohort_ltv_weekly(integer) to authenticated;
