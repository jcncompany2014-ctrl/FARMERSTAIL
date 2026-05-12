-- 쿠폰 audience (대상자) 시스템 — 누구에게 발급할지 admin 에서 설정 가능.
--
-- 이전 구조:
--  - 쿠폰은 code 기반 (WELCOME10 / BIRTHDAY10 등)
--  - cron / banner 가 ENV (NEXT_PUBLIC_WELCOME_COUPON_CODE 등) 로 hard-coded
--    코드를 찾아 매칭. admin 이 "이 쿠폰은 신규 가입자만" 같은 의도를
--    명시적으로 표현 불가.
--
-- 변경:
--  - coupons 에 audience_type 컬럼 추가. enum-like text + CHECK 제약.
--  - 기존 쿠폰들은 code 패턴 기반으로 자동 분류 (WELCOME* → first_signup,
--    BIRTHDAY* → birthday, 나머지 → all). 마이그레이션 직후 admin 이 표를
--    보면서 필요시 수정.
--  - 발급 로직 (WelcomeCouponBanner / birthday cron) 은 다음 단계에서
--    audience_type 기반으로 picking 하도록 갱신 — 그 동안엔 ENV 도 같이
--    살아있어 dual lookup 으로 호환.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'all'
  CHECK (audience_type IN (
    'all',           -- 누구나 코드 입력으로 사용 (기본값)
    'first_signup',  -- 신규 가입자 (결제 0건) 에게 자동 노출 + 적용
    'birthday',      -- 생일 cron 이 매년 자동 발송 대상
    'inactive_30d',  -- 30일 미활동 사용자 재참여 (cron 추가 예정)
    'vip_tier',      -- 등급 = gold / vip 사용자 (정책 정해지면 활성)
    'manual'         -- admin 이 한 명씩 명시 지정 (대량 발급 X)
  ));

CREATE INDEX IF NOT EXISTS coupons_audience_active_idx
  ON public.coupons (audience_type, is_active);

-- 기존 데이터 분류. 운영자가 표 보고 필요시 admin 에서 수정.
UPDATE public.coupons
   SET audience_type = 'first_signup'
 WHERE audience_type = 'all'
   AND code LIKE 'WELCOME%';

UPDATE public.coupons
   SET audience_type = 'birthday'
 WHERE audience_type = 'all'
   AND code LIKE 'BIRTHDAY%';

COMMENT ON COLUMN public.coupons.audience_type IS
  '쿠폰 발급 대상. all=누구나, first_signup=신규, birthday=생일, '
  'inactive_30d=재참여, vip_tier=등급, manual=수동';
