-- ============================================================================
-- Migration: RLS / security audit fixes (Step 5 of roadmap)
-- ============================================================================
--
-- Supabase security advisor가 잡아낸 실제 리스크를 한 번에 정리한다.
-- 각 항목은 개별 리스크이고 상호 간섭이 없어 같은 트랜잭션에 묶어도 안전.
--
-- 적용 전 정리된 상태 (현재 DB 조회 결과 기반):
--   - 모든 25개 public 테이블에 RLS 활성화 ✅
--   - admin 경로는 `is_admin()` 헬퍼로 통일 ✅ (20260423000000 마이그레이션으로 app_metadata 기반)
--
-- 본 마이그레이션이 수정하는 것:
--   1. Function search_path mutable (advisor: 0011_function_search_path_mutable)
--      - `public.handle_new_user` (SECURITY DEFINER trigger — 신규 user 생성 시 profiles row)
--      - `public.reviews_bump_helpful` (trigger)
--      - `public.set_updated_at` (trigger)
--      → `SET search_path = public, pg_temp`로 고정. pg_temp가 함수 본문 resolution을
--        하이재킹 못 하게 차단. SECURITY DEFINER 함수는 특히 중요.
--   2. Public bucket listing (advisor: 0025_public_bucket_allows_listing)
--      - `blog-covers`, `dog-avatars`, `products` 버킷이 storage.objects에 대한
--        broad SELECT 정책을 갖고 있어서 누구든 `list()` API로 파일 목록을 덤프할 수
--        있었음. Public 버킷은 **직접 URL 접근**에 SELECT 정책이 필요 없음 — 파일은
--        `/storage/v1/object/public/...` 경로로 pass-through 접근. LIST/SEARCH만 막으면
--        URL로 가져가는 건 그대로 됨.
--      → 해당 3개 정책 DROP.
--   3. 중복/쓸모없는 정책 정리 (no security impact, just hygiene)
--      - `referral_codes`: `insert own` (role=public) + `_insert_own` (role=authenticated) 같은 정책
--      - `referral_codes`: `select all` (role=public, qual=true) + `_select_own`
--      - `referral_redemptions`: `select own` + `_select_party`
--      → 레거시 public-role 정책 제거, authenticated-role 버전만 유지.
--        `referral_codes select all`은 의도 불명(자기 것 아닌 코드를 전부 읽을 수 있게 됨)이라
--        일단 제거. 추천인 검증은 RPC로 해결해야 함 (코드만 있으면 누구나 검색 가능한 게 맞다면
--        future migration에서 다시 열면 됨).
--
-- 본 마이그레이션이 **수정하지 않는 것** (의도적으로 남겨둠):
--   • `analyses` UPDATE 정책 없음 — 현재 설계상 analyses는 immutable. 버그 아님.
--   • `orders/order_items/coupons/point_ledger` 에 일부 DML 정책 부재 — 서버/service_role에서만
--     조작하는 값이 맞음. 클라이언트가 직접 수정해선 안 되는 데이터.
--   • 많은 정책이 `role=public`으로 걸려 있음 — `authenticated`로 좁히는 게 베스트 프랙티스이긴
--     하지만 현재도 `auth.uid()` 체크가 들어있어 익명 사용자는 자동으로 거부됨. 별도 pass에서
--     통일 정리 예정.
--   • Leaked-password protection 설정 (advisor): Supabase Auth 대시보드 토글. 코드로 못 만짐.
--
-- 롤백
-- ----
-- 1번은 해로움 없이 되돌릴 수 있지만, 2번을 되돌리면(=broad SELECT 복구) 다시 LIST가 열리므로
-- 권장하지 않음.
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Function search_path mutable 수정
-- ──────────────────────────────────────────────────────────────────────────

-- handle_new_user: auth.users INSERT trigger. SECURITY DEFINER로 돌기 때문에
-- search_path가 attacker-controlled면 공격자 스키마의 profiles를 잡을 수 있음.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
begin
  insert into public.profiles (id, email, name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'user_name'
    ),
    now(),
    now()
  );
  return new;
end;
$func$;

-- reviews_bump_helpful: review_helpful INSERT/DELETE trigger. SECURITY DEFINER 아니지만
-- 린터가 모든 함수에 대해 권고하므로 같이 고정.
CREATE OR REPLACE FUNCTION public.reviews_bump_helpful()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $func$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
    return old;
  end if;
  return null;
end;
$func$;

-- set_updated_at: 여러 테이블의 updated_at 자동 갱신 trigger.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $func$
begin
  new.updated_at = now();
  return new;
end;
$func$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Public bucket listing 정책 제거
--    → /storage/v1/object/public/<bucket>/<path> 직접 접근은 계속 가능.
--    → 공급자 LIST API만 막힘 (의도된 방향).
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS blog_covers_public_read  ON storage.objects;
DROP POLICY IF EXISTS dog_avatars_read_public  ON storage.objects;
DROP POLICY IF EXISTS products_public_read     ON storage.objects;

-- ──────────────────────────────────────────────────────────────────────────
-- 3) 중복/부적절 정책 정리
-- ──────────────────────────────────────────────────────────────────────────

-- referral_codes: 레거시 public-role 정책 제거. authenticated-role `_insert_own`/`_select_own`만 남김.
-- "select all (true)"는 추천 코드 전량 노출이라 위험 → 제거. 추후 코드로 친구 찾기가 필요하면
-- RPC(security definer)로 코드→referrer_id 1방향 조회만 열어야 함.
DROP POLICY IF EXISTS "referral_codes insert own" ON public.referral_codes;
DROP POLICY IF EXISTS "referral_codes select all" ON public.referral_codes;

-- referral_redemptions: 레거시 public-role `select own`(referrer_id/referee_id)는 authenticated
-- `_select_party`와 동일 → 중복 제거.
DROP POLICY IF EXISTS "referral_redemptions select own" ON public.referral_redemptions;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (참고)
-- ============================================================================
-- 1) Function search_path 박혔는지:
--    SELECT proname, proconfig FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('handle_new_user','reviews_bump_helpful','set_updated_at','is_admin');
--    → 각 row의 proconfig가 `{search_path=public, pg_temp}` 형태면 OK
--
-- 2) 제거된 스토리지 정책 없음:
--    SELECT policyname FROM pg_policies WHERE schemaname='storage'
--     AND policyname IN ('blog_covers_public_read','dog_avatars_read_public','products_public_read');
--    → 0 rows
--
-- 3) 그래도 공개 URL 접근은 되는지(앱 수준 smoke test):
--    curl -I https://adynmnrzffidoilnxutg.supabase.co/storage/v1/object/public/products/<경로>
--    → 200 OK
