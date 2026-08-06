-- subscriptions.status 에 CHECK — 고객이 판정식의 입력을 직접 쓰고 있었다
-- (2026-08-07 재감사)
--
-- # 무슨 일이 있었나
-- 20260730000000 이 금액 칸을 잠그면서 화이트리스트에 `status` 를 넣어
-- authenticated 에게 UPDATE 를 줬다(해지·일시정지는 고객이 하는 일이니 맞다).
-- 그런데 이 컬럼엔 **CHECK 이 없었다** — 20260527000010 이 "status 컬럼엔
-- CHECK/enum 도 없다 (baseline)" 라고 스스로 적어 뒀다. 유일한 가드
-- `trg_guard_subscription_status` 는 `cancelled → 그 외` 만 막는다.
--
-- 문제는 **다른 방어들이 이 값을 판정식으로 쓴다**는 것이다:
--   · fn_block_dog_delete_with_live_subscription (20260730000400)
--   · subscriptions_one_live_per_dog             (20260730000100)
-- 둘 다 `status in ('active','paused')` 로 판정한다. 즉 고객이 판정식의 입력을
-- 직접 쓴다 — AGENTS 규칙2 가 fresh_ratio 로 겪은 그 구조다.
--
-- 공격: `status = 'paused '`(뒤에 공백) 로 PATCH → 두 판정식 모두 빗나감
--   → 강아지 삭제가 통과(dog_formulas 는 CASCADE 로 소멸, subscriptions.dog_id
--      는 SET NULL)
--   → 다시 `status = 'active'` 로 복귀(cancelled 가 아니므로 기존 가드 통과)
--   → 청구 크론은 dog_id 를 요구하지 않으므로 **강아지도 처방도 없는 구독에
--      계속 청구**된다. 20260730000400 이 막으려던 바로 그 상태다.
--   (charge-amount-guard 는 강아지가 없으면 대조를 건너뛴다.)
--
-- # 고침
-- 값을 세 개로 못 박는다. 코드가 subscriptions.status 에 쓰는 값은 실제로
-- active·paused·cancelled 뿐임을 전수 grep 으로 확인했다.
-- 기존 행 중 이 셋이 아닌 것이 있으면 마이그레이션이 실패하므로, 먼저
-- 정규화한다(공백 제거 + 소문자). 알 수 없는 값은 'cancelled' 로 — 청구가
-- 도는 상태(active)로 올리는 것보다 멈추는 쪽이 안전하다.

update public.subscriptions
   set status = lower(btrim(status))
 where status is distinct from lower(btrim(status));

update public.subscriptions
   set status = 'cancelled'
 where status not in ('active', 'paused', 'cancelled');

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'paused', 'cancelled'));

comment on constraint subscriptions_status_check on public.subscriptions is
  '고객이 UPDATE 할 수 있는 칸이고, 강아지 삭제 방어·중복 구독 방어가 이 값을 판정식으로 쓴다. 임의 문자열(예: "paused "+공백)로 그 방어들을 우회할 수 있어 2026-08-07 에 못 박았다.';
