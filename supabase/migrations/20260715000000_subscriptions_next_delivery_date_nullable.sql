-- next_delivery_date 를 nullable 로.
--
-- # 왜 (2026-07-15 — 사장님 "결제하기 누르면 정기배송을 신청하지 못했어요 뜨는데
--   아직 토스 그거 안 해서?" → 토스와 무관한 DB 제약 위반이었다)
--
-- 2026-07-14 결정: 카드 등록 전 구독은 배송 일정이 없어야 한다(next_delivery_date
-- = NULL). 홈의 hasActiveSub 가 이 값으로 판정하는데, 카드도 안 넣은 구독이
-- '활성/결제됨' 으로 뜨는 문제를 막기 위해서다. 카드 등록에 성공하면 billing-issue
-- 가 그때 첫 배송일(다음 화요일 — lib/shipping-schedule.nextShipDate)을 채운다.
--
-- 그런데 그때 **코드만 바꾸고 이 컬럼의 NOT NULL 을 안 풀었다.** 그 결과
-- OrderClient 의 subscriptions INSERT 가 매번 NOT NULL 위반으로 실패했고 화면엔
-- "정기배송을 신청하지 못했어요" 만 떴다 — 즉 그날 이후 구독 신청이 아예 불가능.
-- (INSERT 가 `supabase as unknown as {...}` 캐스트 뒤에 있어 tsc 도 못 잡았다.)
--
-- # 코드는 이미 nullable 전제로 짜여 있었다 — DDL 만 뒤처졌다
--  · subscription-reminders 크론: .not('next_delivery_date','is',null) 가드 존재
--  · subscription-charge 크론: .lte(...) — SQL 에서 NULL 비교는 참이 아니라 제외됨
--  · dashboard / SubscriptionsClient / accuracy: 타입이 이미 string | null
ALTER TABLE public.subscriptions
  ALTER COLUMN next_delivery_date DROP NOT NULL;

COMMENT ON COLUMN public.subscriptions.next_delivery_date IS
  'NULL = 카드 등록 전이라 배송 일정 미정. billing-issue 가 카드 등록 성공 시 다음 화요일(lib/shipping-schedule.nextShipDate)로 채운다. 크론은 NULL 행을 건너뛴다.';
