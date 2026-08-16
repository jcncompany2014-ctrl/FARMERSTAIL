-- 2026-08-17 4라운드 감사 #21 — account-purge 크론은 구조적으로 절대 성공할 수
-- 없었다: point_ledger(무조건 RAISE 하는 no_delete/no_update 트리거)와
-- payment_events(같은 불변 트리거 + orders 로 FK RESTRICT) 때문에, 결제한 적
-- 있는 계정의 orders 는 어떤 삭제 순서로도 지울 수 없다. 덤으로
-- payment_refund_queue 에는 user_id 컬럼 자체가 없어(order_id 뿐) 크론의
-- deleteStep 이 42703 으로 죽는 코드였다 — 롤백 카나리아가 잡았다.
--
-- # 설계
-- 파기 전체를 한 트랜잭션의 SECURITY DEFINER 함수로. 불변 트리거는 함수 안에서만
-- 내리고(ALTER ... DISABLE TRIGGER) 같은 트랜잭션에서 되살린다 — ALTER 의
-- ACCESS EXCLUSIVE 잠금이 그 사이 다른 세션 쓰기를 막아 열린 창이 없다.
-- (GUC 탈출구 금지 — 아무 롤이나 SET 가능, 요청 경계 못 넘음.)
-- 법리: 전자상거래법 §6 5년 보관의무가 끝난 기록만 온다(탈퇴일 ≥ 5년 전 ⇒
-- 마지막 거래일도 ≥ 5년 전). 그 뒤엔 PIPA §21 파기 의무가 이긴다 — 컷오프는
-- 함수가 스스로 재검증한다(호출자 인자 불신).
-- 검산(롤백 트랜잭션, 프로덕션): 합성 결제 계정 풀그래프 → 보관 기간 중 거부 →
-- 5년 경과 시 orders·payment_events·point_ledger·profiles 전부 삭제 → 트리거
-- 원복 → 권한 anon/authenticated 불가·service_role 만 가능.
create or replace function public.purge_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_at timestamptz;
  v_orders int := 0;
  v_events int := 0;
  v_ledger int := 0;
begin
  select deleted_at into v_deleted_at from public.profiles where id = p_user;
  if v_deleted_at is null then
    raise exception 'purge_user: % 는 탈퇴 상태가 아니다 (deleted_at null 또는 프로필 없음)', p_user;
  end if;
  if v_deleted_at > now() - interval '1825 days' then
    raise exception 'purge_user: % 는 아직 보관 기간이다 (deleted_at=%)', p_user, v_deleted_at;
  end if;

  delete from public.refunds where user_id = p_user;
  delete from public.payment_refund_queue
   where order_id in (select id from public.orders where user_id = p_user);

  alter table public.payment_events disable trigger payment_events_no_delete;
  alter table public.payment_events disable trigger payment_events_no_update;
  delete from public.payment_events
   where order_id in (select id from public.orders where user_id = p_user)
      or actor_user_id = p_user;
  get diagnostics v_events = row_count;
  alter table public.payment_events enable trigger payment_events_no_delete;
  alter table public.payment_events enable trigger payment_events_no_update;

  alter table public.point_ledger disable trigger point_ledger_no_delete;
  alter table public.point_ledger disable trigger point_ledger_no_update;
  delete from public.point_ledger where user_id = p_user;
  get diagnostics v_ledger = row_count;
  alter table public.point_ledger enable trigger point_ledger_no_delete;
  alter table public.point_ledger enable trigger point_ledger_no_update;

  delete from public.subscription_charges where user_id = p_user;
  delete from public.orders where user_id = p_user;
  get diagnostics v_orders = row_count;
  delete from public.subscriptions where user_id = p_user;

  delete from public.consent_log where user_id = p_user;
  delete from public.profiles where id = p_user;

  return jsonb_build_object('orders', v_orders, 'payment_events', v_events, 'point_ledger', v_ledger);
end;
$$;
alter function public.purge_user(uuid) owner to postgres;
revoke all on function public.purge_user(uuid) from public, anon, authenticated;
grant execute on function public.purge_user(uuid) to service_role;
