-- Migration: WELCOME10 + BIRTHDAY10 쿠폰 시드
-- Why: /account 의 WelcomeCouponBanner 가 'WELCOME10' 코드 활성 시 노출.
--      /api/cron/birthday-coupons 가 'BIRTHDAY10' 코드 활성 시 매일 발송.
-- 두 쿠폰 모두 운영자가 admin 콘솔에서 직접 만들지 않아도 즉시 활성 상태로 시작.
--
-- 멱등성: ON CONFLICT (code) DO NOTHING — 이미 존재하면 건드리지 않음.
-- 만료/금액/한도는 admin 이 /admin/coupons 에서 자유롭게 수정 가능.
--
-- 정책 — 두 쿠폰 모두 1년 짜리 무기한 진행. 새 운영 정책으로 빨리 끝내고 싶으면
-- expires_at 을 admin 에서 줄이면 됨.

insert into public.coupons (
  code,
  name,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  max_discount,
  starts_at,
  expires_at,
  usage_limit,
  per_user_limit,
  is_active
) values
  (
    'WELCOME10',
    '첫 구매 환영 쿠폰',
    '신규 가입 후 첫 결제에 적용되는 10% 할인 쿠폰. /account 환영 배너에서 노출.',
    'percent',
    10,
    30000,                      -- 3만원 이상 주문 시
    20000,                      -- 최대 할인 2만원
    now(),
    now() + interval '1 year',
    null,                       -- 전체 사용 한도 무제한
    1,                          -- 1인 1회
    true
  ),
  (
    'BIRTHDAY10',
    '생일 축하 쿠폰',
    '생일 당일 자동 발송되는 10% 할인 쿠폰. /api/cron/birthday-coupons 가 매일 KST 0시 발송.',
    'percent',
    10,
    20000,                      -- 2만원 이상
    15000,                      -- 최대 할인 1만 5천원
    now(),
    now() + interval '1 year',
    null,
    1,                          -- 1인 1회 (해당 연도 1회 자동 발송)
    true
  )
on conflict (code) do nothing;
