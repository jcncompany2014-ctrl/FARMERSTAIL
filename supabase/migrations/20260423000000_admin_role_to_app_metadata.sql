-- ============================================================================
-- Migration: move admin role from user_metadata → app_metadata
-- ============================================================================
--
-- 문제
-- ------
-- 지금까지 어드민 권한 체크는 `auth.users.raw_user_meta_data->>'role'`를 봤다.
-- user_metadata는 **로그인한 사용자가 anon 키로도 자기 값을 바꿀 수 있는**
-- 필드이기 때문에 (`supabase.auth.updateUser({ data: { role: 'admin' } })`),
-- 어떤 일반 사용자든 단 한 줄의 JS로 자기를 admin으로 만들 수 있었다.
--
-- app_metadata는 **service_role 키로만** 수정 가능 → 서버 사이드에서만
-- 부여할 수 있다. 어드민 체크는 이쪽을 봐야 한다.
--
-- 이 마이그레이션이 하는 일
-- ---------------------------
-- 1) user_metadata.role = 'admin'이었던 기존 어드민을 app_metadata.role로 복사
-- 2) user_metadata.role 필드 제거 (더 이상 신뢰하는 값이 아님 명시)
-- 3) profiles 테이블 role 컬럼은 그대로 유지 — 코드는 app_metadata 우선,
--    fallback으로 profiles.role을 읽는 이중 경로를 쓴다 (defense in depth)
--
-- 적용 방법
-- ---------
-- A) Supabase 대시보드 SQL editor에서 실행
-- B) `supabase db push` (CLI 사용 시)
-- C) Supabase MCP: mcp__5f5da1a3-...__apply_migration
--
-- 이 파일은 참고용이자 "이렇게 돌려야 한다"의 기록이다. 코드 레벨 스위치
-- (app_metadata 우선 읽기)는 이 마이그레이션 없이도 안전하게 동작한다:
--   - 새 admin은 반드시 app_metadata에 부여 → 안전
--   - 기존 user_metadata.role = 'admin'인 사용자는 이 마이그레이션이 돌기 전엔
--     admin 권한을 잃은 상태가 됨 (거부 페일) → "admin이 로그인 못 함"으로
--     드러나지 조용히 뚫리는 게 아님
--
-- 롤백
-- -----
-- user_metadata.role을 복원하려면 app_metadata.role 값을 다시 써주면 된다.
-- 단 롤백은 보안 회귀이므로 권장하지 않음.
-- ============================================================================

BEGIN;

-- Step 1: user_metadata.role이 있는 사용자를 app_metadata.role로 복사.
-- 이미 app_metadata.role이 있으면 덮어쓰지 않음 (우선권 유지).
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', raw_user_meta_data ->> 'role')
WHERE raw_user_meta_data ? 'role'
  AND raw_user_meta_data ->> 'role' IS NOT NULL
  AND (raw_app_meta_data ->> 'role') IS NULL;

-- Step 2: user_metadata에서 role 필드 제거. 이후 이 필드를 읽는 코드는 없음.
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';

-- Step 3a: public.is_admin() 함수 재정의.
-- 기존 구현은 `auth.users.raw_user_meta_data->>'role' = 'admin'`을 보고 있었음
-- (CLAUDE_CODE_HANDOFF.md 참고). Step 2에서 user_metadata.role을 지우면 RLS가
-- 곧바로 admin을 잃으니, 같은 트랜잭션에서 함수를 app_metadata를 보도록 바꾼다.
-- profiles.role도 OR 조건으로 받아서 defense-in-depth 유지.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = auth.uid()
      AND (
        (u.raw_app_meta_data ->> 'role') = 'admin'
        OR p.role = 'admin'
      )
  );
$func$;

-- Step 3b: (선택) profiles 테이블이 있다면 그쪽 role도 app_metadata와 동기화.
-- profiles 스키마가 다를 수 있으니 존재 체크부터.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    UPDATE auth.users u
    SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role)
    FROM public.profiles p
    WHERE p.id = u.id
      AND p.role IS NOT NULL
      AND p.role <> ''
      AND (u.raw_app_meta_data ->> 'role') IS NULL;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (수동 실행 권장)
-- ============================================================================
-- 1) app_metadata.role이 'admin'인 사용자 목록:
--    SELECT id, email, raw_app_meta_data ->> 'role' AS role
--    FROM auth.users
--    WHERE raw_app_meta_data ->> 'role' = 'admin';
--
-- 2) user_metadata에 role이 남아있지 않은지:
--    SELECT count(*) FROM auth.users WHERE raw_user_meta_data ? 'role';
--    (결과: 0 이 정상)
--
-- ============================================================================
-- 신규 admin 부여 (앞으로는 이 방식만)
-- ============================================================================
-- SQL (대시보드 SQL editor에서):
--   UPDATE auth.users
--   SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'admin')
--   WHERE email = 'someone@farmerstail.com';
--
-- 또는 Node.js (service_role 키 사용):
--   await supabaseAdmin.auth.admin.updateUserById(userId, {
--     app_metadata: { role: 'admin' }
--   })
--
-- 절대 클라이언트에서 supabase.auth.updateUser({ data: { role: 'admin' } })
-- 쓰지 말 것 — 그건 user_metadata라 이 앱은 무시한다.
