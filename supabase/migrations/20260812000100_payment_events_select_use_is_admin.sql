-- payment_events SELECT 정책이 아직 profiles.role='admin' 인라인 조회를 쓰고 있었다
-- (2026-08-12 반증감사 — 프로덕션에 남은 마지막 하나). 나머지 표는 전부
-- public.is_admin() 정본을 쓴다. 관리자 판정 기준이 두 곳이면 한쪽만 바뀌었을 때
-- 조용히 갈라진다(예: is_admin() 이 추가 조건을 갖게 돼도 이 표만 옛 기준).
--
-- 동작은 동일: 본인 주문의 원장 + 관리자 전체. 쓰기 정책은 원래 없다(insert 는
-- service_role 전용, UPDATE/DELETE 는 block_payment_events_mutations 트리거가 차단).
-- 프로덕션 적용: 2026-08-12 (MCP apply_migration, 적용 후 pg_policies 로 확인).

drop policy if exists payment_events_select on public.payment_events;

create policy payment_events_select on public.payment_events
for select
using (
  exists (
    select 1 from public.orders o
    where o.id = payment_events.order_id
      and o.user_id = (select auth.uid())
  )
  or public.is_admin()
);
