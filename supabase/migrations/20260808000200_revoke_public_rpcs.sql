-- 무인증으로 호출 가능한 RPC 회수 (2026-08-08 보안 재감사)
--
-- # 왜 — PostgreSQL 은 함수에 PUBLIC EXECUTE 를 **기본으로 준다**
-- 20260716030000 이 이 사실을 확인하고 위험한 함수들을 회수했는데, 그 뒤
-- 추가된 것과 목록에서 빠진 것이 남아 있었다.
--
-- ── ① AI 사용량 RPC — 무인증 1회 요청으로 AI 전 기능을 하루 종일 막을 수 있다
--
--   POST /rest/v1/rpc/incr_anthropic_usage {"p_route":"x","p_calls":999999}
--     → sum_anthropic_calls_today() 가 ANTHROPIC_DAILY_CALL_CAP 초과
--     → lib/anthropic-usage.ts 가 exceeded:true
--     → 분석·OCR·챗봇이 **그날 하루 종일 전 사용자에게 503**
--   인증 불필요, 요청 1회, 되돌리려면 DB 를 수동으로 고쳐야 한다.
--
--   지금은 `ANTHROPIC_DAILY_CALL_CAP` 이 미설정이라 DoS 가 성립하지 않고
--   비용 대시보드 오염만 남는다. **출시 체크리스트에 그 env 를 켜는 항목이
--   있으므로, 켜는 순간 취약해진다.** 켜기 전에 이 마이그레이션이 적용돼야 한다.
--
--   sum_anthropic_calls_today() 도 회수한다 — 비로그인이 우리 일일 AI 호출량을
--   조회할 이유가 없다(경미한 사업 지표 유출).
--
--   앱은 둘 다 `createAdminClient()`(service_role) 로만 부른다
--   (lib/anthropic-usage.ts:89, :144) — 회수해도 동작 영향 0.
--
-- ── ② 쿠폰 RPC — 로그인만 하면 누구나 쿠폰 소진 카운터를 되돌릴 수 있다
--
--   revoke_coupon_redemption(p_coupon_code TEXT) 는 소유·권한 검사가 **한 줄도
--   없고** authenticated 에 GRANT 돼 있다. 같은 코드로 N 번 부르면
--   `coupons.used_count` 가 0 으로 리셋 → **상한이 걸린 쿠폰을 무제한 발급**.
--   redeem_coupon(p_coupon_id, p_user_id, p_order_id) 도 `p_user_id` 를 그대로
--   믿어 타인 주문에 소진 기록을 심을 수 있다.
--
--   `record_reward_event` 가 정확히 이 이유로 2026-07-25 에 회수됐는데
--   (20260725000000), 같은 모양의 이 둘은 두 번의 전수 감사가 모두 빠뜨렸다.
--
--   쿠폰은 자동할인으로 폐기됐다(project_coupon_to_autodiscount). DROP 이
--   가장 깔끔하지만 테이블 존재 여부를 코드로 확인할 수 없어 **회수만** 한다 —
--   되살릴 일이 생기면 그때 명시적으로 GRANT 하고, 그 리뷰가 목적이다.
--
-- ── ③ issue_referral_milestones() — 참조 테이블이 이미 드롭된 死 함수
--
--   20260627000000 이 referral_* 테이블을 CASCADE 로 드롭했는데, CASCADE 는
--   plpgsql 본문 참조를 추적하지 않아 함수만 살아남았다. 호출하면
--   `relation does not exist` 로 죽는다. 불필요한 표면이라 지운다.
--
-- 전부 `if exists` / `do $$` 로 감싸 **없는 오브젝트에서도 실패하지 않게** 한다
-- (환경마다 적용 이력이 다를 수 있다).

-- ── ① AI 사용량 ──────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.incr_anthropic_usage(text, bigint, bigint, integer)')
     is not null then
    revoke execute on function
      public.incr_anthropic_usage(text, bigint, bigint, integer)
      from public, anon, authenticated;
    grant execute on function
      public.incr_anthropic_usage(text, bigint, bigint, integer)
      to service_role;
  end if;

  if to_regprocedure('public.sum_anthropic_calls_today()') is not null then
    revoke execute on function public.sum_anthropic_calls_today()
      from public, anon, authenticated;
    grant execute on function public.sum_anthropic_calls_today()
      to service_role;
  end if;
end $$;

-- ── ② 쿠폰 ───────────────────────────────────────────────────────────
do $$
declare
  fn text;
begin
  -- 인자 시그니처가 환경마다 다를 수 있어 이름으로 찾아 전부 회수한다.
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('redeem_coupon', 'revoke_coupon_redemption')
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ── ③ 死 함수 제거 ───────────────────────────────────────────────────
drop function if exists public.issue_referral_milestones();

comment on schema public is
  '2026-08-08: incr_anthropic_usage·sum_anthropic_calls_today·쿠폰 RPC 2개의 PUBLIC EXECUTE 회수, issue_referral_milestones 제거(참조 테이블이 이미 드롭됨).';
