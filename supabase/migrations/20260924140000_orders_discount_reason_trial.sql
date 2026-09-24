-- 2026-09-24 출시 전 점검 — 체험단 결제가 주문 생성 단계에서 전부 막히던 것.
--
-- 구독 체험단(f358b347)은 청구 크론이 orders.discount_reason 에 'trial_cheap' / 'trial_half' 를
-- 쓰는데, 이 표의 CHECK 는 ('tier','promotion','none') 만 허용했다. 그래서 체험단 참가자의 청구는
-- 주문 insert 가 23514 로 실패 → 청구 행 ORDER_INSERT_FAILED → 토스 호출 없음(돈은 안 나감) →
-- 박스도 안 나가고 매일 같은 실패가 반복됐을 것이다. 적용 시점 체험단 등록 0건이라 실제 피해 없음.
--
-- 제약 이름과 기존 값은 그대로 두고 두 값만 더한다(기존 행은 전부 기존 값이라 재검증 통과).
-- 사유 값 목록의 정본은 lib/payments/auto-discount.ts — 규칙96 이 둘을 맞물려 잠근다.

alter table public.orders drop constraint if exists orders_discount_reason_check;
alter table public.orders add constraint orders_discount_reason_check
  check (discount_reason is null or discount_reason = any (array['tier', 'promotion', 'none', 'trial_cheap', 'trial_half']));
