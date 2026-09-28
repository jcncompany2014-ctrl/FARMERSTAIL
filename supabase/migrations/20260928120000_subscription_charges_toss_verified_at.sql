-- 2026-09-28 출시 전 점검 9차 — 결과 불명 자동결제의 토스 확인 표시.
--
-- 타임아웃·토스 5xx 같은 결과 불명 실패는 카드가 실제로 긁혔을 수 있다. 다음 시도를 같은 멱등키로만 믿으면
-- 안 된다: 토스 멱등키는 (API 키·주소·메서드) 단위라 카드 재등록(빌링키 = 주소) 뒤엔 같은 키도 새 청구가 되고,
-- 시도마다 새 주문번호라 주문번호 중복 방어도 안 걸린다 → 같은 회차 이중청구.
-- 그래서 청구 크론이 매 실행 맨 앞에서 이런 행을 토스 주문번호 조회(GET /v1/payments/orders/{orderId})로
-- 확정하고, 확정한 시각을 여기 남긴다. null = 아직 확인 안 됨.
alter table public.subscription_charges
  add column if not exists toss_verified_at timestamptz;

comment on column public.subscription_charges.toss_verified_at is
  '결과 불명 실패를 토스 주문번호 조회로 확정한 시각(null=미확인). 결제돼 있으면 status=pending+payment_key 로 바꿔 재청구 가드가 막는다 — 2026-09-28';
