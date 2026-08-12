-- 4라운드 감사(2026-08-12) — 남의 강아지 데이터 주입 · 관리자 답변 위조 · 주문 품목 끼워넣기 차단.
--
-- # 공통 원인: RLS 정책은 **OR** 로 합쳐진다
-- 가족권한(has_dog_role)으로 게이트한 정책을 새로 넣으면서, 옛 `_own` 정책
-- (auth.uid() = user_id 만 보는 것)을 **안 지웠다**. 그러면 "내 user_id 로
-- 남의 dog_id" 행이 옛 정책을 타고 그대로 통과한다. 정책을 추가할 때 옛 정책을
-- 지우지 않으면 **새 게이트가 무력화된다** — 이 리포에서 세 표가 동시에 그랬다.
--
-- has_dog_role 은 dogs.user_id 주인을 owner 로 인정하므로(SECURITY DEFINER 함수 실측)
-- 옛 정책을 빼도 정상 사용은 깨지지 않는다.
--
-- 프로덕션 적용: 2026-08-12 (MCP apply_migration). 적용 후 검산:
--   cs_messages 고객 UPDATE 가능 컬럼 = read_at 하나 / order_items INSERT = false /
--   weight_logs·analyses 에 게이트된 정책만 잔존.

-- ① weight_logs — 남의 강아지에 체중을 주입하면 그 아이의 칼로리·급여량 계산이 바뀐다.
drop policy if exists weight_logs_insert_own on public.weight_logs;
drop policy if exists weight_logs_update_own on public.weight_logs;
drop policy if exists weight_logs_select_own on public.weight_logs;
drop policy if exists weight_logs_delete_own on public.weight_logs;
-- 남는 것: insert_member / update_member / delete_owner / select(본인 or has_dog_access)

-- ② analyses — INSERT 가 dog 소유권을 전혀 안 봐서 남의 강아지 분석을 위조할 수 있었다.
--    (수의사 공유 리포트가 이 표를 읽는다.)
drop policy if exists "Users can insert own analyses" on public.analyses;
create policy analyses_insert_member on public.analyses
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (dog_id is null or public.has_dog_role(dog_id, 'member'))
);
drop policy if exists "Users can update own analyses" on public.analyses;
create policy analyses_update_member on public.analyses
for update to authenticated
using (
  (select auth.uid()) = user_id
  and (dog_id is null or public.has_dog_role(dog_id, 'member'))
)
with check (
  (select auth.uid()) = user_id
  and (dog_id is null or public.has_dog_role(dog_id, 'member'))
);

-- ③ cs_messages — '읽음 표시' UPDATE 정책이 **컬럼 제한이 없어** 고객이 관리자 답변
--    본문(body)을 통째로 고쳐 쓸 수 있었다. RLS 는 컬럼을 못 막으므로 컬럼 권한으로
--    잠근다: 고객은 read_at 만 UPDATE 가능.
revoke update on public.cs_messages from authenticated;
grant update (read_at) on public.cs_messages to authenticated;

-- ④ order_items — orders INSERT 는 회수했는데 자식 표는 남아 있어, 고객이 자기 주문에
--    임의 품목을 끼워 넣을 수 있었다(발송 목록에 그대로 반영 = 무료 상품).
--    주문·품목은 전부 서버(service_role)가 만든다.
drop policy if exists order_items_insert_via_order on public.order_items;
revoke insert on public.order_items from authenticated, anon;
