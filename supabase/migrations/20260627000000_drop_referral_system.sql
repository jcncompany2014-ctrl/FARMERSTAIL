-- ============================================================================
-- Migration: 레퍼럴(친구 초대) 시스템 전면 제거
-- ============================================================================
--
-- # 배경
-- 사장님 지시(2026-06-27) — 레퍼럴 시스템 폐기. "큰 의미 없음".
-- 코드 측은 같은 브랜치에서 모두 제거됨:
--   - lib/referral.ts, app/r/[code], app/api/referral/welcome-coupon,
--     app/api/cron/referral-milestones, /mypage/referral, ReferralAutoRedeemer,
--     dogs/[id]/share (공유 카드), applySignupProfile 의 redeem 호출 등.
--   - vercel.json 의 referral-milestones cron 등록 해제.
-- 따라서 이 migration 적용 시점엔 referral 테이블/RPC 를 호출하는 런타임 코드가 0.
--
-- # ⚠️ 적용 순서 (중요)
-- 반드시 **위 코드 변경이 배포 완료된 뒤** 이 migration 을 적용한다.
-- 순서가 뒤바뀌면(테이블 먼저 DROP → 구 코드가 아직 RPC 호출) 가입 직후
-- redeem_referral_code 호출이 에러를 던진다(가입 자체는 막지 않게 try/catch 돼
-- 있으나, 불필요한 500 로그 발생).
--
-- # 제거 대상
--   테이블: referral_codes, referral_redemptions, referral_milestone_rewards
--   함수:   redeem_referral_code, get_or_create_my_referral_code,
--           issue_referral_milestones
-- referral_codes / referral_redemptions / redeem_referral_code /
-- get_or_create_my_referral_code 는 버전관리 이전(R-사이클 전)에 live DB 에 직접
-- 생성된 객체라 CREATE migration 이 없음(POST_LAUNCH_BACKLOG R100-A 참고).
-- → IF EXISTS + pg_proc 동적 DROP 으로 시그니처 불확실성에 안전하게 대응한다.
--
-- # 보존되는 것
--   - point_ledger: 그대로 유지. 이미 적립된 추천/마일스톤 보상 P 는 회수하지 않음
--     (reference_type='referral' / 'referral_milestone' 과거 row 도 보존).
--   - coupons 테이블의 REFER_FRIEND_5000(친구 초대 환영 쿠폰) row 는 여기서 건드리지
--     않음 — 쿠폰 테이블 전체를 드롭하는 별도 마이그(쿠폰→자동할인 ④)에서 함께 제거.
--     audience='manual' 이라 자동 노출 안 되고, grant 하던 endpoint 가 이미 삭제돼 inert.
-- ============================================================================

BEGIN;

-- ── 1. RPC(함수) 제거 ──────────────────────────────────────────────────────
-- live-DB-only 함수 포함 → 이름으로 모든 오버로드를 동적 DROP(시그니처 무관).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT 'DROP FUNCTION IF EXISTS public.'
             || quote_ident(p.proname)
             || '(' || pg_get_function_identity_arguments(p.oid) || ') CASCADE' AS stmt
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'redeem_referral_code',
        'get_or_create_my_referral_code',
        'issue_referral_milestones'
      )
  LOOP
    EXECUTE r.stmt;
  END LOOP;
END $$;

-- ── 2. 테이블 제거 ─────────────────────────────────────────────────────────
-- CASCADE 로 잔여 RLS 정책 / 인덱스 / 제약 동반 제거.
DROP TABLE IF EXISTS public.referral_milestone_rewards CASCADE;
DROP TABLE IF EXISTS public.referral_redemptions CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;

COMMIT;
