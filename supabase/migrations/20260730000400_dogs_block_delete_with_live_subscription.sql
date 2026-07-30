-- 진행 중인 정기배송이 있는 강아지는 지울 수 없다 (2026-07-30 최종감사 후속)
--
-- # 문제 — 강아지를 지우면 구독은 살아남아 계속 청구된다
-- `subscriptions.dog_id` 의 FK 는 **ON DELETE SET NULL** 이고
-- `dog_formulas.dog_id` 는 **CASCADE** 다(실측). 그래서 강아지를 지우면:
--
--   · 처방(dog_formulas)  → 전부 삭제
--   · 구독(subscriptions) → dog_id 만 NULL, **status='active' 와
--                            next_delivery_date 는 그대로**
--
-- 결과: 청구 크론은 그 구독을 계속 골라 카드를 긁는다. 그런데 강아지도 처방도
-- 없으니 피킹 리스트에 담을 내용이 없다 — **돈은 나가고 박스는 안 온다.**
-- 게다가 재계산 검문소는 강아지가 없으면 대조를 건너뛰므로(알림 전용) 아무도
-- 눈치채지 못한다. 삭제 화면에는 검사가 **아예 없었다**(그냥 delete).
--
-- 20260730000100(강아지당 진행 중 구독 1개) 주석에 "강아지 삭제 시 활성 구독
-- 검사는 별도 작업" 이라고 적어 둔 그 후속이다.
--
-- 적용 전 실측: dog_id IS NULL 인 구독 1건 — 이미 cancelled·카드 없음(무해).
-- 살아있는 고아는 없으니 데이터 정리는 필요 없다.
--
-- # 왜 자동 해지가 아니라 차단인가
-- 돈이 오가는 관계를 **말없이 끝내지 않는다.** 오탭으로 강아지를 지웠는데 구독이
-- 함께 사라지면 되돌릴 수 없다(카드 재등록부터 다시 해야 한다). 반대로 차단은
-- 고객이 '해지'(또는 결제 전이면 '취소')를 한 번 누르는 것으로 끝난다 —
-- 그 화면에 이미 있는 버튼이다.
--
-- # 계정 삭제(탈퇴)와의 관계
-- 탈퇴 라우트는 예전에 **강아지를 먼저 지우고 그 다음에 구독을 해지**했다.
-- 이 트리거가 있으면 그 순서로는 탈퇴가 막힌다. 그래서 라우트를 고쳐
-- **구독 해지·카드 토큰 삭제를 먼저** 하도록 순서를 바꿨다
-- (app/api/account/delete/route.ts). 그게 원래 옳은 순서다 — 탈퇴 처리 중
-- 어디서 실패하든 **돈이 먼저 멈춰 있어야** 한다. 예전 순서는 강아지 삭제만
-- 성공하고 해지가 실패하면 탈퇴한 사람의 카드가 계속 긁히는 상태였다.
--
-- # 판정 범위
-- status in ('active','paused') — 20260730000100 의 unique index 와 **같은 집합**.
-- cancelled 는 대상 밖(해지 이력은 남아야 하고, dog_id 가 NULL 이 되어도 무해).

create or replace function public.fn_block_dog_delete_with_live_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_count int;
begin
  select count(*) into live_count
  from public.subscriptions s
  where s.dog_id = old.id
    and s.status in ('active', 'paused');

  if live_count > 0 then
    raise exception
      '진행 중인 정기배송이 있어 이 아이를 지울 수 없어요. 정기배송을 먼저 정리해 주세요.'
      using errcode = 'FT100';
  end if;

  return old;
end;
$$;

comment on function public.fn_block_dog_delete_with_live_subscription() is
  '강아지 삭제 전 진행 중(active/paused) 정기배송을 검사한다. 있으면 FT100 으로 거부 — subscriptions FK 가 SET NULL 이라 그냥 지우면 강아지·처방 없는 구독이 계속 청구된다(돈은 나가고 박스는 안 옴). 2026-07-30.';

drop trigger if exists trg_dogs_block_delete_with_live_subscription on public.dogs;

create trigger trg_dogs_block_delete_with_live_subscription
  before delete on public.dogs
  for each row
  execute function public.fn_block_dog_delete_with_live_subscription();
