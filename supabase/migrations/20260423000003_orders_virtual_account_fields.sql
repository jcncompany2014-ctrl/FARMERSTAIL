-- 가상계좌 결제 지원 필드 추가.
--
-- 여태까지 orders 테이블은 payment_key / payment_method 만 저장하고 있어,
-- 가상계좌로 결제한 고객이 "어느 은행 어느 계좌번호로 언제까지 입금해야 하나"
-- 를 앱에서 다시 확인하려면 토스의 안내 이메일/SMS에 의존해야 했다.
-- 이 마이그레이션은 Toss confirm/webhook 응답의 virtualAccount 필드를 그대로
-- 저장할 자리를 만든다.
--
-- 필드는 모두 nullable — 카드 결제는 값이 없는 게 정상. 표시 쪽에서
-- `IF NULL → 섹션 숨김` 패턴으로 분기.
--
-- bank_code 는 한국은행 표준 금융기관 코드 (2자리) — 은행명 매핑은 앱
-- 레이어의 bankCodeLabel() 에서 처리. DB는 원시 코드만 보존해서 은행명이
-- 변경돼도 과거 주문이 깨지지 않도록.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS virtual_account_bank text,
  ADD COLUMN IF NOT EXISTS virtual_account_number text,
  ADD COLUMN IF NOT EXISTS virtual_account_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS virtual_account_holder text;

-- 가상계좌 입금 만료 조회를 위해 dueDate 에 가벼운 인덱스.
-- 만료 임박 주문을 스캔하는 cron (이후 스텝)에 쓰일 예정.
-- partial index: 가상계좌 결제가 아닌 행은 인덱싱하지 않음.
CREATE INDEX IF NOT EXISTS orders_virtual_account_due_date_idx
  ON public.orders (virtual_account_due_date)
  WHERE virtual_account_due_date IS NOT NULL;

COMMENT ON COLUMN public.orders.virtual_account_bank IS
  'Toss virtualAccount.bankCode — 한국은행 표준 2자리 금융기관 코드. 표시 매핑은 lib/payments/toss.ts::bankCodeLabel 참고.';
COMMENT ON COLUMN public.orders.virtual_account_number IS
  '가상계좌번호. 최대 20자리 숫자/하이픈.';
COMMENT ON COLUMN public.orders.virtual_account_due_date IS
  '가상계좌 입금 마감 일시 (Toss 기준 자정). 이후 자동 EXPIRED 웹훅이 옴.';
COMMENT ON COLUMN public.orders.virtual_account_holder IS
  '가상계좌 예금주명. Toss가 채워 주는 값으로, 입금 시 수취인 이름과 대조용.';

COMMIT;
