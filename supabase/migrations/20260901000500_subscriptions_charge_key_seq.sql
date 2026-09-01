-- 2026-09-01 출시 전 감사 — 멱등키 앵커를 전용 컬럼으로 분리한다.
--
-- # 지금까지
-- 청구 멱등키 접미사의 앵커가 `failed_charge_count` 였다. 그런데 그 값은 세 경우에
-- 오른다: permanent(카드 만료류) · 확정거절(잔액부족류) · **unknown**.
-- 앞의 둘은 "돈이 안 나간 게 보장"이라 새 키를 써도 안전하지만,
-- **unknown 은 결과 불명**이다 — 토스가 우리 분류표에 없는 코드나 코드 없는 5xx 를
-- 주면서 카드는 실제로 캡처된 경우가 여기 들어온다. 그때 키가 갈아타므로
-- 다음 재시도가 **새 청구**가 된다(= 같은 회차에 두 번 긁힘).
-- lib/payments/billing-error-classify.ts 가 스스로 "null 은 절대 여기 넣지 말 것 —
-- 돈이 나갔을 수 있다"고 적어 둔 불변식이 unknown 경로에서 깨져 있었다.
--
-- 게다가 `failed_charge_count` 는 **카드 재등록 시 0 으로 리셋**된다
-- (app/api/payments/billing-issue). 그러면 접미사가 사라져 **이미 써버린 base 키로
-- 되돌아가고**, 토스가 저장해 둔 옛 거절(15일 보관)을 재생해 재등록한 고객의
-- 결제가 계속 실패한다. billing-error-classify 의 "접미사는 큰 쪽으로만 움직인다"는
-- 단언이 사실이 아니었다(AGENTS.md 규칙4 — 없는 방어를 주장하는 주석).
--
-- # 이제부터
-- `charge_key_seq` = 멱등키 전용 앵커.
--   · **돈이 안 나간 게 보장된 실패에서만** 오른다(permanent · 확정거절).
--   · unknown·타임아웃·네트워크에는 **안 오른다** → 같은 키 유지 → 토스가 원결제
--     결과를 재생 → 이중청구 없음.
--   · **어디서도 리셋하지 않는다.** 카드 재등록도 건드리지 않는다 — 그래야 다음
--     청구가 한 번도 안 쓴 키로 나가 깨끗한 새 결제가 된다.
-- `failed_charge_count` 는 3-strike 정지 판정 전용으로 남는다(재등록 시 리셋 유지).
--
-- 기존 행은 현재 failed_charge_count 로 시드한다 — 이미 그 값으로 키를 써 왔으므로
-- 앵커가 뒤로 가지 않게 하려면 그대로 이어받아야 한다.
alter table public.subscriptions
  add column if not exists charge_key_seq integer not null default 0;

update public.subscriptions
set charge_key_seq = greatest(coalesce(failed_charge_count, 0), 0)
where charge_key_seq = 0;

comment on column public.subscriptions.charge_key_seq is
  '청구 멱등키 접미사 앵커. 돈이 안 나간 게 보장된 실패(permanent·확정거절)에서만 증가하고 절대 리셋하지 않는다. unknown/타임아웃에는 증가시키지 말 것 — 이중청구가 된다.';

-- subscriptions 는 고객 쓰기 화이트리스트 표라 새 컬럼은 자동으로 차단된다
-- (20260730000000_subscriptions_lock_money_columns). 확인만 하고 별도 GRANT 는 않는다.
