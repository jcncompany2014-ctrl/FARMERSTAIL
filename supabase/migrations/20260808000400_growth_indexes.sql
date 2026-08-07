-- 성장 대비 인덱스 2개 (2026-08-08 성능 감사 — 프로덕션 pg_indexes 실측 후 확정).
--
-- 감사가 지목한 5개 후보 중 3개는 실측에서 이미 존재했다(orders.subscription_id,
-- orders.order_number UNIQUE, weight_logs 양축). 실제로 없는 것은 아래 둘뿐이다.
-- 지금 데이터 규모(수십 행)에선 체감이 없지만, 두 테이블 모두 가입자 수에
-- 비례해 무한 누적되는 축이라 미리 깔아 둔다. 코드 의존성 없음 — 적용 순서와
-- 배포 순서가 무관하다(2026-08-06 has_billing_key 사고와 다른 종류).

-- ① activity_logs — 홈 대시보드가 열릴 때마다 user_id 축으로 조회하는데
--    (app/(main)/dashboard/page.tsx) 프로덕션엔 dog_id 축 인덱스만 있다.
create index if not exists activity_logs_user_occurred_idx
  on public.activity_logs (user_id, occurred_at desc);

-- ② subscriptions — 마이페이지·웹 구독 관리는 전 상태(해지 포함)를 user_id 로
--    조회하는데, 있는 건 partial(status='active')뿐이라 대체가 안 된다
--    (partial 인덱스는 조건이 포함 관계여야 쓰인다).
create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);
